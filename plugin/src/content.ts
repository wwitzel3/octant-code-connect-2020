import * as octant from "@project-octant/plugin";
import * as h from "@project-octant/plugin/helpers";

import { TextFactory } from "@project-octant/plugin/components/text";
import { LinkFactory } from "@project-octant/plugin/components/link";
import { CardFactory } from "@project-octant/plugin/components/card";
import { EditorFactory } from "@project-octant/plugin/components/editor";

import { FlexLayoutFactory } from "@project-octant/plugin/components/flexlayout";
import { GridActionsFactory } from "@project-octant/plugin/components/grid-actions";
import { V1Deployment, V1Service } from "@kubernetes/client-node";
import { SummaryFactory } from "@project-octant/plugin/components/summary";
import { ComponentFactory } from "@project-octant/plugin/components/component-factory";

const PREFIX = "/code-connect-2020";
const DEPLOYMENT_COLUMNS = ["Name", "Title", "Filename", "Deployment"];

/**
 * getHandler returns the details of a specific entity
 * @param this instance of octant.Plugin
 * @param params router params and properties of octant.ContentRequest
 */
export function getHandler(this: any, params: any): octant.ContentResponse {
  const name: string = params.deploymentName;
  const title = [
    new LinkFactory({ value: "Code Connect 2020", ref: PREFIX }),
    new LinkFactory({ value: "Deployments", ref: PREFIX + "/deployments" }),
    new TextFactory({ value: name }),
  ];

  const httpClient = this.httpClient as octant.HTTPClient;
  const dashboardClient = this.dashboardClient as octant.DashboardClient;

  let deployment: any;

  httpClient.getJSON(
    `http://localhost:4200/deployments/${name}`,
    (result: any) => {
      deployment = result;
    }
  );

  const internalSummary = new SummaryFactory({
    sections: [
      {
        header: "Name",
        content: new TextFactory({ value: deployment.name }).toComponent(),
      },
      {
        header: "Title",
        content: new TextFactory({ value: deployment.title }).toComponent(),
      },
    ],
  });

  let entityDetails = new CardFactory({
    body: internalSummary.toComponent(),
    factoryMetadata: {
      title: [new TextFactory({ value: `${name} - Internal` }).toComponent()],
    },
  }).toComponent();

  let k8sSummary: ComponentFactory<any>;

  try {
    const k8sDeployment = dashboardClient.Get({
      apiVersion: "apps/v1",
      kind: "Deployment",
      namespace: "default",
      name: deployment.name,
    }) as V1Deployment;

    const k8sService = dashboardClient.Get({
      apiVersion: "v1",
      kind: "Service",
      namespace: "default",
      name: deployment.name,
    }) as V1Service;

    k8sSummary = new SummaryFactory({
      sections: [
        {
          header: "Deployment",
          content: h.genLinkFromObject(k8sDeployment, dashboardClient),
        },
        {
          header: "Service",
          content: h.genLinkFromObject(k8sService, dashboardClient),
        },
      ],
    });
  } catch (e) {
    k8sSummary = new TextFactory({value: "Not installed."})
  }

  let apiDetails = new CardFactory({
    body: k8sSummary.toComponent(),
    factoryMetadata: {
      title: [
        new TextFactory({ value: ` ${name} - Kubernetes` }).toComponent(),
      ],
    },
    options: {}
  }).toComponent();

  let layout = new FlexLayoutFactory({
    options: {
      sections: [
        [
          { width: h.Width.Half, view: entityDetails },
          { width: h.Width.Half, view: apiDetails },
        ],
      ],
    },
    factoryMetadata: {
      title: [new TextFactory({ value: "Details" }).toComponent()],
    },
  });

  const editor = new EditorFactory({
    value: deployment.data,
    readOnly: true,
    metadata: { filename: deployment.filename },
    factoryMetadata: {
      title: [new TextFactory({ value: "YAML" }).toComponent()],
      accessor: "yaml",
    },
  });
  return h.createContentResponse(title, [layout, editor]);
}

/**
 *
 * @param this instance of octant.Plugin
 * @param params router params and properties of octant.ContentRequest
 */
export function listHandler(this: any, params: any): octant.ContentResponse {
  const title = [
    new TextFactory({ value: "Code Connect 2020" }),
    new TextFactory({ value: "Deployments" }),
  ];

  const table = new h.TableFactoryBuilder(title, DEPLOYMENT_COLUMNS);

  const httpClient = this.httpClient as octant.HTTPClient;

  httpClient.getJSON("http://localhost:4200/deployments", (results: any) => {
    results.forEach((deployment: any) => {
      const row = new h.TableRow(
        {
          Name: new LinkFactory({
            value: deployment.name,
            ref: `${PREFIX}/deployments/${deployment.name}`,
          }),
          Title: new TextFactory({ value: deployment.title }),
          Filename: new TextFactory({ value: deployment.filename }),
          Deployment: checkIfInstalled(this.dashboardClient, deployment),
        },
        { gridActions: deploymentGridActions(params.clientID, deployment) }
      );
      // if (metadata?.deletionTimestamp)
      // isDeleting = true
      table.push(row);
    });
  });

  return h.createContentResponse(title, [table.getFactory()]);
}

/**
 * notFoundHandler returns a not found content response
 * @param this instance of octant.Plugin
 * @param params router params and properties of octant.ContentRequest
 */
export function notFoundHandler(this: any, param: any): octant.ContentResponse {
  const title = [
    new TextFactory({ value: "Code Connect 2020" }),
    new TextFactory({ value: "Not found" }),
  ];
  const text = new TextFactory({ value: "Not Found." });
  return h.createContentResponse(title, [text]);
}

function checkIfInstalled(
  client: octant.DashboardClient,
  result: any
): TextFactory | LinkFactory {
  try {
    const deployments = client.List({
      apiVersion: "apps/v1",
      kind: "Deployment",
      namespace: "default",
      labelSelector: {
        matchLabels: { app: result.name, "managed-by": "code-2020-plugin" },
      },
    });
    if (deployments.length > 0) {
      const ref = h.refFromObject(deployments[0]);
      const path = client.RefPath(ref);
      return new TextFactory({
        value: `[${ref.name}](/#/${path})`,
        options: { isMarkdown: true },
      });
    } else {
      return new TextFactory({ value: "Not installed." });
    }
  } catch (e) {
    return new TextFactory({ value: "Error Getting Status" });
  }
}

function deploymentGridActions(clientID: string, obj: any): GridActionsFactory {
  return new GridActionsFactory({
    actions: [
      {
        name: "Install",
        actionPath: "action.codeconnect2020.dev/installDeployment",
        payload: {
          name: obj.name,
          clientID: clientID,
        },
        type: "primary",
      },
      {
        name: "Delete",
        actionPath: "action.codeconnect2020.dev/deleteDeployment",
        payload: {
          name: obj.name,
          clientID: clientID,
        },
        confirmation: {
          title: `Delete ${obj.name}`,
          body: `Are you sure you want to delete ${obj.title}?`,
        },
        type: "danger",
      },
    ],
  });
}
