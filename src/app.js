"use strict";

var r = require("react-wrapper");
var easeTween = require("ease-tween");
var tweenState = require("react-tween-state");
var Loader = require("worker?inline!./loader");
var MISSING_TILE_IDS = require("./missing-tile-ids.js");

var TILE_SIZE    = 1000;
var IMAGE_SIZE   = 1024;
var FIRST_TILE_X = 490;
var LAST_TILE_X  = 572;
var FIRST_TILE_Y = 148;
var LAST_TILE_Y  = 208;
var TILE_X_COUNT = LAST_TILE_X - FIRST_TILE_X + 1;
var TILE_Y_COUNT = LAST_TILE_Y - FIRST_TILE_Y + 1;
// var INITIAL_TILE_X = 530;
// var INITIAL_TILE_Y = 180;

// function tileToLocalX(tx) {
//   return tx - FIRST_TILE_X;
// }
//
// function tileToLocalTileY(ty) {
//   return LAST_TILE_Y - ty;
// }

function localToTileX(lx) {
  return FIRST_TILE_X + lx;
}

function localToTileY(ly) {
  return LAST_TILE_Y - ly;
}

function pointToLocalX(px, zoomRatio) {
  return (
    Math.min(
      Math.floor(px / (IMAGE_SIZE * zoomRatio)),
      TILE_X_COUNT - 1));
}

function pointToLocalY(py, zoomRatio) {
  return (
    Math.min(
      Math.floor(py / (IMAGE_SIZE * zoomRatio)),
      TILE_Y_COUNT - 1));
}


module.exports = {
  mixins: [tweenState.Mixin],

  getInitialState: function () {
    return {
      zoomPower: 3
    };
  },

  componentDidMount: function () {
    this.node         = r.domNode(this);
    this.canvas       = this.node.firstChild;
    this.scrollLeft   = this.node.scrollLeft;
    this.scrollTop    = this.node.scrollTop;
    this.clientWidth  = this.node.clientWidth;
    this.clientHeight = this.node.clientHeight;
    this.node.addEventListener("scroll", this.onScroll);
    addEventListener("resize", this.onResize);
    addEventListener("keydown", this.onKeyDown);
    this.tileData   = {};
    this.imageData  = {};
    this.imageQueue = [];
    this.startLoader();
    this.computeVisibleTiles();
    this.forceQueueAllTiles();
    this.loadVisibleTiles();
    this.paint();
  },

  componentWillUnmount: function () {
    this.node.removeEventListener("scroll", this.onScroll);
    removeEventListener("resize", this.onResize);
    removeEventListener("keydown", this.onKeyDown);
    this.stopLoader();
  },

  componentDidUpdate: function () {
    this.computeVisibleTiles();
    this.loadVisibleTiles();
    this.paint();
  },

  onScroll: function (event) {
    this.scrollLeft = this.node.scrollLeft;
    this.scrollTop  = this.node.scrollTop;
    this.computeVisibleTiles();
    this.loadVisibleTiles();
    this.paint();
  },

  onResize: function (event) {
    this.clientWidth  = this.node.clientWidth;
    this.clientHeight = this.node.clientHeight;
    this.computeVisibleTiles();
    this.loadVisibleTiles();
    this.paint();
  },




  getZoomPower: function () {
    return this.getTweeningValue("zoomPower");
  },

  getZoomLevel: function () {
    return Math.pow(2, this.getZoomPower());
  },

  getZoomRatio: function () {
    return 1 / this.getZoomLevel();
  },

  computeVisibleTiles: function () {
    var zoomRatio = this.getZoomRatio();
    this.fvlx = pointToLocalX(this.scrollLeft, zoomRatio);
    this.lvlx = pointToLocalX(this.scrollLeft + this.clientWidth - 1, zoomRatio);
    this.fvly = pointToLocalY(this.scrollTop, zoomRatio);
    this.lvly = pointToLocalY(this.scrollTop + this.clientHeight - 1, zoomRatio);
    this.fvtx = localToTileX(this.fvlx);
    this.lvtx = localToTileX(this.lvlx);
    this.fvty = localToTileY(this.fvly);
    this.lvty = localToTileY(this.lvly);
  },

  isTileVisible: function (tileId) {
    var txy = tileId.split("-");
    var tx = parseInt(txy[0]);
    var ty = parseInt(txy[1]);
    return this.isTileVisible_(tx, ty);
  },

  isTileVisible_: function (tx, ty) {
    return (
      tx >= this.fvtx &&
      tx <= this.lvtx &&
      ty <= this.fvty &&
      ty >= this.lvty);
  },

  isImageVisible: function (imageId) {
    var txyz = imageId.split("-");
    var tx = parseInt(txyz[0]);
    var ty = parseInt(txyz[1]);
    var tz = parseInt(txyz[2]);
    return this.isImageVisible_(tx, ty, tz);
  },

  isImageVisible_: function (tx, ty, tz) {
    var zoomPower = this.getZoomPower();
    return (
      this.isTileVisible_(tx, ty) && (
        tz === Math.floor(zoomPower) ||
        tz === Math.ceil(zoomPower)));
  },





  startLoader: function () {
    this.loader = new Loader();
    this.loader.addEventListener("message", this.onMessage);
    this.loader.postMessage({
        message: "setOrigin",
        origin:  location.origin
      });
  },

  stopLoader: function () {
    this.loader.terminate();
    this.loader.removeEventListener("message", this.onMessage);
  },

  onMessage: function (event) {
    switch (event.data.message) {
      case "tileDidLoad":
        this.tileDidLoad(event.data.tileId, event.data.tileData);
        break;
    }
  },

  forceQueueAllTiles: function () {
    this.loader.postMessage({
        message: "forceQueueAllTiles",
        ftx: FIRST_TILE_X,
        ltx: LAST_TILE_X,
        fty: FIRST_TILE_Y,
        lty: LAST_TILE_Y
      });
  },

  loadVisibleTiles: function () {
    clearTimeout(this.pendingLoad);
    this.pendingLoad = setTimeout(this.loadVisibleTilesNow, 0);
  },

  loadVisibleTilesNow: function () {
    var zoomPower = this.getZoomPower();
    var tileIds = [];
    for (var ty = this.lvty; ty <= this.fvty; ty++) {
      for (var tx = this.lvtx; tx >= this.fvtx; tx--) {
        var tileId = tx + "-" + ty;
        if (!(tileId in MISSING_TILE_IDS)) {
          if (!(tileId in this.tileData)) {
            tileIds.push(tileId);
          } else {
            var floorImageId = tileId + "-" + Math.floor(zoomPower);
            var ceilImageId  = tileId + "-" + Math.ceil(zoomPower);
            if (!(floorImageId in this.imageData)) {
              this.imageQueue.push(floorImageId);
            }
            if (ceilImageId !== floorImageId && !(ceilImageId in this.imageData)) {
              this.imageQueue.push(ceilImageId);
            }
          }
        }
      }
    }
    this.loader.postMessage({
        message: "loadTiles",
        tileIds: tileIds
      });
    this.renderNextImage();
  },

  tileDidLoad: function (tileId, tileData) {
    this.tileData[tileId] = tileData;
    if (this.isTileVisible(tileId)) {
      var zoomPower = this.getZoomPower();
      var floorImageId = tileId + "-" + Math.floor(zoomPower);
      var ceilImageId  = tileId + "-" + Math.ceil(zoomPower);
      this.imageQueue.push(floorImageId);
      if (ceilImageId !== floorImageId) {
        this.imageQueue.push(ceilImageId);
      }
      this.renderNextImage();
    }
  },



  renderNextImage: function () {
    var pendingImageId;
    while (this.imageQueue.length) {
      var imageId = this.imageQueue.pop();
      if (!(imageId in this.imageData) && this.isImageVisible(imageId)) {
        pendingImageId = imageId;
        break;
      }
    }
    if (pendingImageId) {
      var imageData = this.renderImage(pendingImageId);
      this.imageData[pendingImageId] = imageData;
      this.paint();
      clearTimeout(this.pendingRender);
      this.pendingRender = setTimeout(this.renderNextImage, 0);
    }
  },

  renderRoadLinks: function (c, zoomLevel, roadLinks) {
    c.lineWidth = 2 * Math.sqrt(zoomLevel) * (TILE_SIZE / IMAGE_SIZE);
    for (var i = 0; i < roadLinks.length; i++) {
      var ps = roadLinks[i].ps;
      c.beginPath();
      c.moveTo(ps[0].x, ps[0].y);
      for (var j = 1; j < ps.length; j++) {
        c.lineTo(ps[j].x, ps[j].y);
      }
      c.stroke();
    }
  },

  renderRoadNodes: function (c, zoomLevel, roadNodes) {
    var rectSize = 4 * Math.sqrt(zoomLevel) * (TILE_SIZE / IMAGE_SIZE);
    for (var i = 0; i < roadNodes.length; i++) {
      var p = roadNodes[i].p;
      c.fillRect(p.x - rectSize, p.y - rectSize, rectSize * 2, rectSize * 2);
    }
  },

  renderImage: function (imageId) {
    var txyz = imageId.split("-");
    var tx = parseInt(txyz[0]);
    var ty = parseInt(txyz[1]);
    var tz = parseInt(txyz[2]);
    var tileId = tx + "-" + ty;
    var tileData = this.tileData[tileId];
    var zoomLevel = 1 << tz;
    var zoomRatio = 1 / zoomLevel;
    var imageSize = IMAGE_SIZE * window.devicePixelRatio * zoomRatio;
    var canvas = document.createElement("canvas");
    canvas.width  = imageSize;
    canvas.height = imageSize;
    var c = canvas.getContext("2d");
    c.scale(imageSize / TILE_SIZE, imageSize / TILE_SIZE);
    c.translate(-tx * TILE_SIZE, -ty * TILE_SIZE);
    c.fillStyle   = "#f93";
    c.strokeStyle = "#f63";
    c.font         = 18 * Math.sqrt(zoomLevel) + 'px "HelveticaNeue-UltraLight", Helvetica, Arial, sans-serif';
    c.textAlign    = "left";
    c.textBaseline = "top";
    c.globalCompositeOperation = "screen";
    this.renderRoadLinks(c, zoomLevel, tileData.roadLinks);
    this.renderRoadNodes(c, zoomLevel, tileData.roadNodes);
    return canvas;
  },


  paint: function () {
    if (!this.pendingPaint) {
      this.pendingPaint = true;
      window.requestAnimationFrame(this.paintNow);
    }
  },

  paintNow: function () {
    var width  = window.devicePixelRatio * this.clientWidth;
    var height = window.devicePixelRatio * this.clientHeight;
    var canvas = this.canvas;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width  = width;
      canvas.height = height;
    }
    var c = canvas.getContext("2d", {alpha: false});
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.scale(window.devicePixelRatio, window.devicePixelRatio);
    c.fillStyle   = "#000";
    c.strokeStyle = "#0f0";
    c.fillRect(0, 0, this.clientWidth, this.clientHeight);
    this.paintTileBorders(c);
    this.paintTileContents(c);
    this.pendingPaint = false;
  },

  paintTileBorders: function (c) {
    var zoomLevel = this.getZoomLevel();
    var zoomRatio = 1 / zoomLevel;
    c.save();
    c.translate(-this.scrollLeft + 0.25, -this.scrollTop + 0.25);
    c.scale(zoomRatio, zoomRatio);
    c.lineWidth   = 0.5 * zoomLevel;
    c.fillStyle   = "#333";
    c.strokeStyle = "#333";
    c.font        = 24 * Math.sqrt(zoomLevel) + 'px "HelveticaNeue-UltraLight", Helvetica, Arial, sans-serif';
    c.textAlign   = "left";
    c.textBaseline = "top";
    for (var lx = this.fvlx; lx <= this.lvlx; lx++) {
      for (var ly = this.fvly; ly <= this.lvly; ly++) {
        var tx = localToTileX(lx);
        var ty = localToTileY(ly);
        if (zoomLevel < 8) {
          c.fillText(tx + "×" + ty, lx * IMAGE_SIZE + 4 * Math.sqrt(zoomLevel), ly * IMAGE_SIZE);
        }
        c.strokeRect(lx * IMAGE_SIZE, ly * IMAGE_SIZE, IMAGE_SIZE, IMAGE_SIZE);
      }
    }
    c.restore();
  },

  paintTileContents: function (c) {
    var zoomPower = this.getZoomPower();
    var zoomLevel = Math.pow(2, zoomPower);
    var zoomRatio = 1 / zoomLevel;
    c.translate(-this.scrollLeft, -this.scrollTop);
    c.scale(zoomRatio, -zoomRatio);
    c.translate(0, -TILE_Y_COUNT * IMAGE_SIZE);
    for (var lx = this.fvlx; lx <= this.lvlx; lx++) {
      for (var ly = this.fvly; ly <= this.lvly; ly++) {
        var tx = localToTileX(lx);
        var ty = localToTileY(ly);
        var imageId = tx + "-" + ty + "-" + Math.round(zoomPower);
        if (imageId in this.imageData) {
          c.drawImage(this.imageData[imageId], lx * IMAGE_SIZE, (TILE_Y_COUNT - ly - 1) * IMAGE_SIZE, IMAGE_SIZE, IMAGE_SIZE);
        }
      }
    }
  },


  tweenZoomPower: function (duration, endValue) {
    this.tweenState("zoomPower", {
        duration: duration,
        endValue: endValue,
        easing: function (elapsed, startValue, endValue, duration) {
          return startValue + (endValue - startValue) * easeTween.ease(elapsed / duration);
        },
        onEnd: function () {
          console.log("zoomPower", this.state.zoomPower);
        }.bind(this)
      });
  },

  onKeyDown: function (event) {
    // console.log("keyDown", event.keyCode);
    if (event.keyCode >= 49 && event.keyCode <= 58) {
      this.tweenZoomPower(500, event.keyCode - 49);
    } else if (event.keyCode === 187) {
      this.tweenZoomPower(250, Math.max(0, (Math.round(this.state.zoomPower * 10) - 2) / 10));
    } else if (event.keyCode === 189) {
      this.tweenZoomPower(250, Math.min((Math.round(this.state.zoomPower * 10) + 2) / 10), 8);
    }
  },

  onClick: function (event) {
    // console.log("click", event.clientX, event.clientY);
  },

  render: function () {
    var scale = IMAGE_SIZE * this.getZoomRatio();
    return (
      r.div("map-frame",
        r.canvas("map-picture"),
        r.div({
            className: "map-space",
            style: {
              width:  TILE_X_COUNT * scale,
              height: TILE_Y_COUNT * scale
            },
            onClick: this.onClick
          })));
  }
};

r.makeComponent("App", module);
