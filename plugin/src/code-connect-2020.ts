// core-js and regenerator-runtime are requried to ensure the correct polyfills
// are applied by babel/webpack.
import "core-js/stable";
import "regenerator-runtime/runtime";

// plugin contains interfaces your plugin can expect
// this includes your main plugin class, response, requests, and clients.
import * as octant from "@project-octant/plugin";

// helpers for generating the
// objects that Octant can render to components.
import * as h from "@project-octant/plugin/helpers";

// components
import { TextFactory } from "@project-octant/plugin/components/text";

// rxjs is used to show that Observables function within
// the Octant JavaScript runtime.
import { Subject, BehaviorSubject } from "rxjs";
import { CardFactory } from "@project-octant/plugin/components/card";
import { FlexLayoutFactory } from "@project-octant/plugin/components/flexlayout";
import { SummaryFactory } from "@project-octant/plugin/components/summary";

import { router } from "./routes";
import { V1ObjectMeta } from "@kubernetes/client-node";
import { LinkFactory } from "@project-octant/plugin/components/link";

// This plugin will handle v1/Pod types.
const podGVK = { version: "v1", kind: "Pod" };
const deploymentGVK = { group: "apps", version: "v1", kind: "Deployment" };
const serviceGVK = { version: "v1", kind: "Service" };

const CodeConnect2020: octant.PluginConstructor = class CodeConnect2020
  implements octant.Plugin {
  // Static fields that Octant uses
  name = "code-connect-2020";
  description = "demo for code connect 2020";

  // If true, the contentHandler and navigationHandler will be called.
  isModule = true;

  // Octant will assign these via the constructor at runtime.
  dashboardClient: octant.DashboardClient;
  httpClient: octant.HTTPClient;

  // Plugin capabilities
  capabilities = {
    supportPrinterConfig: [serviceGVK, podGVK, deploymentGVK],
    actionNames: [
      "action.octant.dev/setNamespace",
      "action.codeconnect2020.dev/installDeployment",
    ],
  };

  // We want to keep track of the current selected namespace
  currentNamespace: Subject<string>;

  // Octant expects plugin constructors to accept two arguments, the dashboardClient and the httpClient
  constructor(
    dashboardClient: octant.DashboardClient,
    httpClient: octant.HTTPClient
  ) {
    this.dashboardClient = dashboardClient;
    this.httpClient = httpClient;

    this.currentNamespace = new BehaviorSubject("default");
  }

  printHandler(request: octant.ObjectRequest): octant.PrintResponse {
    const metadata = request.object.metadata as V1ObjectMeta;
    if (metadata.labels) {
      console.log(JSON.stringify(metadata.labels));
      if (metadata.labels["managed-by"] === "code-2020-plugin") {
        const config = new SummaryFactory({
          sections: [
            {
              header: "Managed By",
              content: new LinkFactory({
                value: "code-connect-2020",
                ref: `/code-connect-2020/deployments/${metadata.labels["app"]}`,
              }).toComponent(),
            },
          ],
        });
        return h.createPrintResponse(config);
      }
    }
    return h.createPrintResponse();
  }

  actionHandler(request: octant.ActionRequest): octant.ActionResponse | void {
    if (request.actionName === "action.octant.dev/setNamespace") {
      this.currentNamespace.next(request.payload.namespace);
      return;
    }
    if (request.actionName === "action.codeconnect2020.dev/installDeployment") {
      console.log("calling action");
      this.httpClient.getJSON(
        "http://localhost:4200/deployments/" + request.payload.name,
        (result: any) => {
          this.currentNamespace.subscribe((ns: string) => {
            const resp = this.dashboardClient.Update(ns, result.data);
            console.log(ns);
            console.log(resp);
            this.dashboardClient.SendEvent(
              request.clientID,
              "event.octant.dev/alert",
              { type: "SUCCESS", message: resp, expiration: 10 }
            );
          });
        }
      );
    }
    return;
  }

  tabHandler(request: octant.ObjectRequest): octant.TabResponse {
    let cardA = new CardFactory({
      body: new TextFactory({ value: "card body A" }).toComponent(),
      factoryMetadata: {
        title: [new TextFactory({ value: "Card A" }).toComponent()],
      },
    }).toComponent();

    let cardB = new CardFactory({
      body: new TextFactory({ value: "card body B" }).toComponent(),
      factoryMetadata: {
        title: [new TextFactory({ value: "Card B" }).toComponent()],
      },
    }).toComponent();

    let layout = new FlexLayoutFactory({
      options: {
        sections: [
          [
            { width: h.Width.Half, view: cardA },
            { width: h.Width.Half, view: cardB },
          ],
        ],
      },
    });

    return h.createTabResponse("Code Connect 2020", layout);
  }

  navigationHandler(): octant.Navigation {
    const nav = new h.Navigation(
      "Code Connect 2020",
      "code-connect-2020",
      "cloud"
    );
    nav.add("Deployments", "deployments");
    return nav;
  }

  contentHandler(request: octant.ContentRequest): octant.ContentResponse {
    return h.contentResponseFromRouter(this, router, request);
  }
};

export default CodeConnect2020;

console.log("loading code-connect-2020.ts");
