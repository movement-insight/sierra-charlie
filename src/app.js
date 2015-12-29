"use strict";

var GeometryLoader = require("./geometry-loader");
var Painter = require("./painter");
var Renderer = require("./renderer");

var r = require("react-wrapper");
var compute = require("./compute");
var defs = require("./defs");
var easeStateMixin = require("./ease-state-mixin");


module.exports = {
  mixins: [
    easeStateMixin
  ],

  getInitialState: function () {
    return {
      leftSignal:    0.4897637424698795,
      topSignal:     0.4768826844262295,
      rawTimeSignal: 10 + 9 / 60,
      zoomSignal:    4
    };
  },

  easeLeft: function (left, duration) {
    this.easingLeft = true;
    this.easeState("leftSignal", left, duration, function () {
        this.easingLeft = false;
      }.bind(this));
  },
 
  easeTop: function (top, duration) {
    this.easingTop = true;
    this.easeState("topSignal", top, duration, function () {
        this.easingTop = false;
      }.bind(this));
  },

  easeRawTime: function (rawTime, duration) {
    this.easingRawTime = true;
    this.easeState("rawTimeSignal", rawTime, duration, function () {
        this.easingRawTime = false;
      }.bind(this));
  },

  easeZoom: function (zoom, duration) {
    this.easingZoom = true;
    this.easeState("zoomSignal", zoom, duration, function () {
        this.easingZoom = false;
      }.bind(this));
  },


  _updateLoader: function () {
    this._geometryLoader.update(this.easedLeftSignal, this.easedTopSignal);
  },

  _updateRenderer: function () {
    this._renderer.update({
        canvas:    this.canvas,
        left:      this.easedLeftSignal,
        top:       this.easedTopSignal,
        easedTime: this.easedTimeSignal,
        easedZoom: this.easedZoomSignal
      });
  },
  
  _updatePainter: function () {
    this._painter.update({
        canvas:    this.canvas,
        left:      this.easedLeftSignal,
        top:       this.easedTopSignal,
        easedTime: this.easedTimeSignal,
        easedZoom: this.easedZoomSignal
      });
  },

  onTileLoad: function (tileId, tileData) {
    this._updateRenderer();
    this._updatePainter();
  },
  
  onImageRender: function (imageId) {
    this._updatePainter();
  },

  componentDidMount: function () {
    this._geometryLoader = new GeometryLoader({
        onTileLoad: this.onTileLoad
      });
    this._renderer = new Renderer({
        getLoadedTile: this._geometryLoader.getLoadedTile.bind(this._geometryLoader),
        onImageRender: this.onImageRender
      });
    this._painter = new Painter({
        getRenderedGroup: this._renderer.getRenderedGroup.bind(this._renderer)
      });
    
    this.node = r.domNode(this);
    this.canvas = this.node.firstChild;
    this.node.addEventListener("scroll", this.onScroll);
    this.forceUpdate(); // Trigger a React re-render to update the size of map-space
    this.computeDerivedState();
    this.exportScrollPosition();
    this._updateLoader();
    this._updateRenderer();
    this._updatePainter();
  },

  componentDidUpdate: function () {
    this.update();
  },

  update: function () {
    this.computeDerivedState();
    this.exportScrollPosition();
    this._updateLoader();
    this._updateRenderer();
    this._updatePainter();
  },

  onScroll: function (event) {
    if (!this.easingLeft && !this.easingTop && !this.easingZoom) {
      this.importScrollPosition();
    }
  },

  importScrollPosition: function () {
    this.setState({
        leftSignal: this.node.scrollLeft / compute.spaceWidth(this.easedZoomSignal),
        topSignal:  this.node.scrollTop / compute.spaceHeight(this.easedZoomSignal)
      });
  },

  computeDerivedState: function () {
    this.easedLeftSignal = this.getEasedState("leftSignal");
    this.easedTopSignal  = this.getEasedState("topSignal");
    this.easedTimeSignal = compute.time(this.getEasedState("rawTimeSignal"));
    this.easedZoomSignal = this.getEasedState("zoomSignal");
  },

  exportScrollPosition: function () {
    this.node.scrollLeft = compute.scrollLeft(this.easedLeftSignal, this.easedZoomSignal);
    this.node.scrollTop  = compute.scrollTop(this.easedTopSignal, this.easedZoomSignal);
  },

  onDoubleClick: function (event) {
    // console.log("doubleClick", event.clientX, event.clientY);
    var left = compute.fromClientX(event.clientX, this.canvas.clientWidth, this.easedLeftSignal, this.easedZoomSignal);
    var top  = compute.fromClientY(event.clientY, this.canvas.clientHeight, this.easedTopSignal, this.easedZoomSignal);
    var delay = !event.shiftKey ? 500 : 2500;
    this.easeLeft(left, delay);
    this.easeTop(top, delay);
    if (!event.altKey) {
      this.easeZoom(Math.max(0, this.state.zoomSignal - 1), delay);
    } else {
      this.easeZoom(Math.min(this.state.zoomSignal + 1, defs.maxZoom), delay);
    }
  },

  render: function () {
    return (
      r.div("map-frame",
        r.canvas("map-picture"),
        r.div({
            className: "map-space",
            style: {
              width:  compute.spaceWidth(this.easedZoomSignal),
              height: compute.spaceHeight(this.easedZoomSignal)
            },
            onDoubleClick: this.onDoubleClick
          })));
  }
};

r.makeComponent("App", module);
