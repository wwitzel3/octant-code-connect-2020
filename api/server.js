var fs = require("fs");
var express = require("express");
var cors = require("cors");
var bodyParser = require("body-parser");
var app = express();

var deployments = [
    {name: "simpleapp", title: "K8S Bootcamp", filename: "yaml/simpleapp.yaml" },
    {name: "httpbin", title: "HTTPBIN Tool", filename: "yaml/httpbin.yaml" },
    {name: "hello-node", title: "Hello Node", filename: "yaml/hello-node.yaml" },
];

app.use(cors());
app.use(bodyParser.json());

app.get("/deployments", async (req, res) => {
  try {
    res.json(deployments);
  } catch (error) {
    console.log(error);
    return next(error);
  }
});

app.get("/deployments/:name", async (req, res) => {
  const name = req.params.name;
  const details = deployments.find(d => d.name === name);
  try {
    fs.readFile("./" + details["filename"], "utf8", function (err, data) {
      if (err) {
        throw err;
      }
      details["data"] = data;
      res.json(details);
    });
  } catch (error) {
    console.log(error);
    return next(error);
  }
});

app.listen(4200, "127.0.0.1");
