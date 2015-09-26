"use strict";

var defs = require("./defs");


function ImageId(lx, ly, zoomPower) {
  this._lx = lx;
  this._ly = ly;
  this._zoomPower = zoomPower;
}

ImageId.prototype.toString = function () {
  return this._lx + "!" + this._ly + "!" + this._zoomPower;
};

ImageId.prototype.getLocalX = function () {
  return this._lx;
};

ImageId.prototype.getLocalY = function () {
  return this._ly;
};

ImageId.prototype.getZoomPower = function () {
  return this._zoomPower;
};

module.exports = {
  ImageId: ImageId,

  fromTileId: function (tileId, zoomPower) {
    return new ImageId(tileId.getLocalX(), tileId.getLocalY(), zoomPower);
  }
};
