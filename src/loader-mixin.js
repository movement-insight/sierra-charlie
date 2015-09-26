"use strict";

var LoaderWorker = require("worker?inline!./loader-worker");
var defs = require("./defs");
var tid = require("./tile-id");


function deflate(tileIds) {
  return (
    tileIds.map(function (tileId) {
        return tileId.toUrl();
      }));
}

function inflate(tileId) {
  return tid.fromUrl(tileId);
}

function spirally(tx, ty, k, cb) {
  cb(tx, ty);
  for (var n = 0; n <= k; n++) {
    for (var i = 1; i <= n * 2; i++) {
      cb(tx + n,     ty + n - i);
      cb(tx - n + i, ty + n);
      cb(tx - n,     ty - n + i);
      cb(tx + n - i, ty - n);
    }
  }
}


module.exports = {
  componentDidMount: function () {
    this.collectedTileIds = [];
    this.loadedTiles = {};
    this.startLoaderWorker();
    // this.collectAllTilesToQueue();
  },

  componentWillUnmount: function () {
    this.stopLoaderWorker();
    clearTimeout(this.pendingLoad);
  },

  setLoadedTile: function (tileId, tileData) {
    this.loadedTiles[tileId] = tileData;
  },

  getLoadedTile: function (tileId) {
    return this.loadedTiles[tileId];
  },

  startLoaderWorker: function () {
    this.loaderWorker = new LoaderWorker();
    this.loaderWorker.addEventListener("message", this.onMessage);
    this.loaderWorker.postMessage({
        message: "setOrigin",
        origin:  location.origin
      });
  },

  stopLoaderWorker: function () {
    this.loaderWorker.terminate();
    this.loaderWorker.removeEventListener("message", this.onMessage);
  },

  collectTileToQueue: function (tileId) {
    this.collectedTileIds.push(tileId);
  },

  queueTilesToLoad: function () {
    var tileIds = this.collectedTileIds.reverse();
    this.collectedTileIds = [];
    if (tileIds.length) {
      this.loaderWorker.postMessage({
          message: "queueTilesToLoad",
          tileIds: deflate(tileIds)
        });
      return true;
    }
    return false;
  },

  loadNextTile: function () {
    this.loaderWorker.postMessage({
        message: "loadNextTile"
      });
  },

  onMessage: function (event) {
    switch (event.data.message) {
      case "tileLoaded":
        this.onTileLoaded(inflate(event.data.tileId), event.data.tileData);
        break;
    }
  },

  onTileLoaded: function (tileId, tileData) {
    this.setLoadedTile(tileId, tileData);
    this.loadVisibleTiles();
  },

  collectAllTilesToQueue: function () {
    var atx = defs.localToTileX(Math.floor(this.getEasedAttentionLeft() * defs.tileXCount));
    var aty = defs.localToTileY(Math.floor(this.getEasedAttentionTop() * defs.tileYCount));
    var layerCount = (
      Math.max(
        Math.max(atx, defs.lastTileX - atx),
        Math.max(aty, defs.lastTileY - aty)));
    spirally(atx, aty, layerCount, function (tx, ty) {
        if (defs.isTileValid(tx, ty)) {
          var tileId = new tid.TileId(tx, ty);
          this.collectTileToQueue(tileId);
        }
      }.bind(this));
  },

  loadVisibleTilesNow: function () {
    var atx = defs.localToTileX(Math.floor(this.getEasedAttentionLeft() * defs.tileXCount));
    var aty = defs.localToTileY(Math.floor(this.getEasedAttentionTop() * defs.tileYCount));
    var layerCount = (
      Math.max(
        Math.max(atx - this.firstVisibleTileX, this.lastVisibleTileX - atx),
        Math.max(aty - this.firstVisibleTileY, this.lastVisibleTileY - aty)));
    var easedZoomPower = this.getEasedZoomPower();
    var floorZoomPower = Math.floor(easedZoomPower);
    var ceilZoomPower  = Math.ceil(easedZoomPower);
    spirally(atx, aty, layerCount, function (tx, ty) {
        if (this.isTileVisible(tx, ty)) {
          var tileId = new tid.TileId(tx, ty);
          if (!this.getLoadedTile(tileId)) {
            this.collectTileToQueue(tileId);
          } else {
            this.collectImagesToQueue(tileId, floorZoomPower, ceilZoomPower);
          }
        }
      }.bind(this));
    if (this.queueTilesToLoad()) {
      this.loadNextTile();
    }
    if (this.queueImagesToRender()) {
      this.renderNextImage();
    }
  },

  loadVisibleTiles: function () {
    clearTimeout(this.pendingLoad);
    this.pendingLoad = setTimeout(this.loadVisibleTilesNow, 0);
  }
};
