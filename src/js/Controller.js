"use strict";

var Geometry = require("./Geometry");
var Grid = require("./Grid");
var Indexset = require("./Indexset");
var Polyquadtree = require("./Polyquadtree");
var Quadtree = require("./Quadtree");

var compute = require("./compute");
var defs = require("./defs");
var polyline = require("./polyline");
var rect = require("./rect");
var vector = require("./vector");


function Controller() {
  this.prevClientX = 0;
  this.prevClientY = 0;
  window.Geometry = this.geometry = new Geometry({ // TODO
      onRoadNodesLoaded: this.onRoadNodesLoaded.bind(this),
      onRoadLinksLoaded: this.onRoadLinksLoaded.bind(this)
    });
  window.Grid = this.grid = new Grid(); // TODO
  window.RoadNodeTree = this.roadNodeTree = new Quadtree(defs.quadtreeLeft, defs.quadtreeTop, defs.quadtreeSize, this.geometry.getRoadNodePoint.bind(this.geometry)); // TODO
  window.RoadLinkTree = this.roadLinkTree = new Polyquadtree(defs.quadtreeLeft, defs.quadtreeTop, defs.quadtreeSize, this.geometry.getRoadLinkBounds.bind(this.geometry)); // TODO
  this.hoveredRoadNode = null;
  this.hoveredRoadNodeIndices = new Indexset();
  this.hoveredRoadLink = null;
  this.hoveredRoadLinkIndices = new Indexset();
  this.selectedRoadNode = null;
  this.selectedRoadNodeIndices = new Indexset();
  this.selectedRoadLink = null;
  this.selectedRoadLinkIndices = new Indexset();
  var frame = document.getElementById("map-frame");
  frame.addEventListener("scroll", this.onFrameScrolled.bind(this));
  var canvas = document.getElementById("map-canvas");
  canvas.addEventListener("webglcontextlost", this.onCanvasContextLost.bind(this));
  canvas.addEventListener("webglcontextrestored", this.onCanvasContextRestored.bind(this));
  var space = document.getElementById("map-space");
  space.addEventListener("mousemove", this.onMouseMoved.bind(this));
  space.addEventListener("click", this.onMouseClicked.bind(this));
  space.addEventListener("dblclick", this.onMouseDoubleClicked.bind(this));
  window.addEventListener("keydown", this.onKeyPressed.bind(this));
  window.addEventListener("resize", this.onWindowResized.bind(this));
  window.addEventListener("orientationchange", this.onWindowResized.bind(this));
  window.matchMedia("screen and (min-resolution: 2dppx)").addListener(this.onWindowResized.bind(this));
}

Controller.prototype = {
  getClientWidth: function () {
    var canvas = document.getElementById("map-canvas");
    return canvas.clientWidth;
  },

  getClientHeight: function () {
    var canvas = document.getElementById("map-canvas");
    return canvas.clientHeight;
  },

  fromClientPoint: function (clientP) {
    var clientWidth = this.getClientWidth();
    var clientHeight = this.getClientHeight();
    var centerX = App.getCenterX();
    var centerY = App.getCenterY();
    var zoom = App.getZoom();
    return compute.fromClientPoint(clientP, clientWidth, clientHeight, centerX, centerY, zoom);
  },

  toClientPoint: function (p) {
    var clientWidth = this.getClientWidth();
    var clientHeight = this.getClientHeight();
    var centerX = App.getCenterX();
    var centerY = App.getCenterY();
    var zoom = App.getZoom();
    return compute.toClientPoint(p, clientWidth, clientHeight, centerX, centerY, zoom);
  },

  findClosestFeature: function (clientP) {
    var cursorP = this.fromClientPoint(clientP);
    var cursorR = vector.bounds(100, cursorP);
    var roadNodes = this.roadNodeTree.select(cursorR);
    var closestRoadNodeDistance = Infinity;
    var closestRoadNode = null;
    for (var i = 0; i < roadNodes.length; i++) {
      var p = this.geometry.getRoadNodePoint(roadNodes[i])
      var distance = vector.distance(cursorP, p);
      if (distance < closestRoadNodeDistance) {
        closestRoadNodeDistance = distance;
        closestRoadNode = roadNodes[i];
      }
    }
    var roadLinks = this.roadLinkTree.select(cursorR);
    var closestRoadLinkDistance = Infinity;
    var closestRoadLink = null;
    for (var i = 0; i < roadLinks.length; i++) {
      var ps = this.geometry.getRoadLinkPoints(roadLinks[i]);
      var distance = polyline.distance(cursorP, ps);
      if (distance < closestRoadLinkDistance) {
        closestRoadLinkDistance = distance;
        closestRoadLink = roadLinks[i];
      }
    }
    if (closestRoadNode && closestRoadNodeDistance <= closestRoadLinkDistance + 4) {
      return {
        key: "roadNode",
        roadNode: closestRoadNode,
        cursorP: cursorP
      };
    } else if (closestRoadLink) {
      return {
        key: "roadLink",
        roadLink: closestRoadLink,
        cursorP: cursorP
      };
    } else {
      return {
        cursorP: cursorP
      };
    }
  },

  updateHovered: function (clientX, clientY) {
    var result = this.findClosestFeature({
        x: clientX,
        y: clientY
      });
    this.hoveredRoadNode = null;
    this.hoveredRoadNodeIndices.clear();
    this.hoveredRoadLink = null;
    this.hoveredRoadLinkIndices.clear();
    UI.ports.setHoveredLocation.send(result.cursorP);
    if (result.key === "roadNode") {
      this.hoveredRoadNode = result.roadNode;
      var index = this.geometry.getRoadNodeIndex(this.hoveredRoadNode);
      this.hoveredRoadNodeIndices.insertPoint(index);
      var p = this.geometry.getRoadNodePoint(this.hoveredRoadNode);
      UI.ports.setHoveredAnchor.send(this.toClientPoint(p));
      UI.ports.setHoveredToid.send(this.hoveredRoadNode.toid);
    } else if (result.key === "roadLink") {
      this.hoveredRoadLink = result.roadLink;
      var indices = this.geometry.getRoadLinkIndices(this.hoveredRoadLink);
      this.hoveredRoadLinkIndices.insertLine(indices);
      var ps = this.geometry.getRoadLinkPoints(this.hoveredRoadLink);
      UI.ports.setHoveredAnchor.send(polyline.approximateMidpoint(ps));
      UI.ports.setHoveredToid.send(this.hoveredRoadLink.toid);
    } else {
      UI.ports.setHoveredAnchor.send(null);
      UI.ports.setHoveredToid.send(null);
    }

    var gl = App.drawingContext.gl; // TODO
    this.hoveredRoadNodeIndices.render(gl, gl.DYNAMIC_DRAW);
    this.hoveredRoadLinkIndices.render(gl, gl.DYNAMIC_DRAW);
    App.isDrawingNeeded = true; // TODO
  },

  updateSelected: function (clientX, clientY) {
    this.selectedRoadNode = null;
    this.selectedRoadNodeIndices.clear();
    this.selectedRoadLink = null;
    this.selectedRoadLinkIndices.clear();
    if (this.hoveredRoadNode) {
      this.selectedRoadNode = this.hoveredRoadNode;
      this.selectedRoadNodeIndices.copy(this.hoveredRoadNodeIndices);
      var p = this.geometry.getRoadNodePoint(this.selectedRoadNode);
      UI.ports.setSelectedToid.send(this.selectedRoadNode.toid);
      UI.ports.setSelectedLocation.send([p]);
      UI.ports.setSelectedAnchor.send(this.toClientPoint(p));
    } else if (this.hoveredRoadLink) {
      this.selectedRoadLink = this.hoveredRoadLink;
      this.selectedRoadLinkIndices.copy(this.hoveredRoadLinkIndices);
      var ps = this.geometry.getRoadLinkPoints(this.hoveredRoadLink);
      UI.ports.setSelectedLocation.send([ps[0], ps[ps.length - 1]]);
      UI.ports.setSelectedAnchor.send(polyline.approximateMidpoint(ps));
      UI.ports.setSelectedToid.send(this.selectedRoadLink.toid);
    } else {
      UI.ports.setSelectedLocation.send([]);
      UI.ports.setSelectedAnchor.send(null);
      UI.ports.setSelectedToid.send(null);
    }

    var gl = App.drawingContext.gl; // TODO
    this.selectedRoadNodeIndices.render(gl, gl.DYNAMIC_DRAW);
    this.selectedRoadLinkIndices.render(gl, gl.DYNAMIC_DRAW);
    App.isDrawingNeeded = true; // TODO
  },

  onRoadNodesLoaded: function (roadNodes) {
    for (var i = 0; i < roadNodes.length; i++) {
      this.roadNodeTree.insert(roadNodes[i]);
    }
    App.updateDrawingContext(); // TODO
    UI.ports.setLoadingProgress.send(this.geometry.getLoadingProgress());
  },

  onRoadLinksLoaded: function (roadLinks) {
    for (var i = 0; i < roadLinks.length; i++) {
      this.roadLinkTree.insert(roadLinks[i]);
    }
    App.updateDrawingContext(); // TODO
    UI.ports.setLoadingProgress.send(this.geometry.getLoadingProgress());
  },

  onFrameScrolled: function (event) {
    if (!(App.isScrolling())) {
      var frame = document.getElementById("map-frame");
      var zoom = App.getZoom();
      var newCenterX = compute.centerXFromScrollLeft(frame.scrollLeft, zoom);
      var newCenterY = compute.centerYFromScrollTop(frame.scrollTop, zoom);
      App.setStaticCenter(newCenterX, newCenterY);
    }
    this.updateHovered(this.prevClientX, this.prevClientY);
  },

  onCanvasContextLost: function (event) {
    event.preventDefault();
    // cancelAnimationFrame(this.isAnimationFrameRequested); // TODO
    // this.isAnimationFrameRequested = null;
    // this.drawingContext = null;
  },

  onCanvasContextRestored: function () {
    // this.startDrawing(); // TODO
  },

  onMouseMoved: function (event) {
    // console.log("mouseMove", event.clientX, event.clientY);
    this.updateHovered(event.clientX, event.clientY);
    this.prevClientX = event.clientX;
    this.prevClientY = event.clientY;
  },

  onMouseClicked: function (event) {
    var duration = event.shiftKey ? 2500 : 500;
    this.updateSelected(this.clientX, event.clientY);
    if (this.selectedRoadNode) {
      var p = this.geometry.getRoadNodePoint(this.selectedRoadNode);
      App.setCenter(p, duration);
    } else if (this.selectedRoadLink) {
      var ps = this.geometry.getRoadLinkPoints(this.selectedRoadLink);
      App.setCenter(polyline.approximateMidpoint(ps), duration);
    }
  },

  onMouseDoubleClicked: function (event) {
    // console.log("doubleClick", event.clientX, event.clientY);
    var zoom = App.getZoom();
    var duration = event.shiftKey ? 2500 : 500;
    var newCenter = compute.clampPoint(this.fromClientPoint({
        x: event.clientX,
        y: event.clientY
      }));
    var newZoom = compute.clampZoom(event.altKey ? zoom + 1 : zoom - 1);
    App.setCenter(newCenter, duration);
    App.setZoom(newZoom, duration);
  },

  onKeyPressed: function (event) {
    // console.log("keyDown", event.keyCode);
    var clientWidth = this.getClientWidth();
    var clientHeight = this.getClientHeight();
    var centerX = App.getStaticCenterX();
    var centerY = App.getStaticCenterY();
    var rawTime = App.getStaticRawTime();
    var zoom = App.getStaticZoom();
    var pageWidth = compute.fromClientWidth(clientWidth, zoom);
    var pageHeight = compute.fromClientHeight(clientHeight, zoom);
    var duration = event.shiftKey ? 2500 : 500;
    // var timeDelta = event.altKey ? 60 : 3600;
    var zoomDelta = event.altKey ? 2 : 10; // TODO
    switch (event.keyCode) {
      case 37: // left
      case 36: // home
        var scale = event.keyCode === 36 ? 1 : 10;
        App.setCenterX(compute.clampX(centerX - pageWidth / scale), duration);
        break;
      case 39: // right
      case 35: // end
        var scale = event.keyCode === 35 ? 1 : 10;
        App.setCenterX(compute.clampX(centerX + pageWidth / scale), duration);
        break;
      case 38: // up
      case 33: // page up
        var scale = event.keyCode === 33 ? 1 : 10;
        App.setCenterY(compute.clampY(centerY + pageHeight / scale), duration);
        break;
      case 40: // down
      case 34: // page down
        var scale = event.keyCode === 34 ? 1 : 10;
        App.setCenterY(compute.clampY(centerY - pageHeight / scale), duration);
        break;
      // case 219: // left bracket
      //   var newRawTime = Math.round((rawTime * 3600) - timeDelta) / 3600;
      //   App.setRawTime(newRawTime, duration);
      //   break;
      // case 221: // right bracket
      //   var newRawTime = Math.round((rawTime * 3600) + timeDelta) / 3600;
      //   App.setRawTime(newRawTime, duration);
      //   break;
      case 187: // plus
        var newZoom = compute.clampZoom(Math.round((zoom * 10) - zoomDelta) / 10);
        App.setZoom(newZoom, duration);
        break;
      case 189: // minus
        var newZoom = compute.clampZoom(Math.round((zoom * 10) + zoomDelta) / 10);
        App.setZoom(newZoom, duration);
        break;
      default: // 1-8
        if (event.keyCode >= 49 && event.keyCode <= 57) {
          var newZoom = compute.clampZoom(event.keyCode - 49);
          App.setZoom(newZoom, duration);
        }
    }
  },

  onWindowResized: function () {
    App.isDrawingNeeded = true; // TODO
  }
};

module.exports = Controller;