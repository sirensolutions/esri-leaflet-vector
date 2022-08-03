/* esri-leaflet-vector - v3.1.3-siren-v1 - Wed Aug 03 2022 09:48:21 GMT+0100 (British Summer Time)
 * Copyright (c) 2022 Environmental Systems Research Institute, Inc.
 * Apache-2.0 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('leaflet'), require('esri-leaflet'), require('mapbox-gl')) :
  typeof define === 'function' && define.amd ? define(['exports', 'leaflet', 'esri-leaflet', 'mapbox-gl'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.L = global.L || {}, global.L.esri = global.L.esri || {}, global.L.esri.Vector = {}), global.L, global.L.esri, global.mapboxgl));
})(this, (function (exports, leaflet, esriLeaflet, mapboxgl) { 'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var mapboxgl__default = /*#__PURE__*/_interopDefaultLegacy(mapboxgl);

  var version = "3.1.3-siren-v1";

  /*
    utility to establish a URL for the basemap styles API
    used primarily by VectorBasemapLayer.js
  */
  function getBasemapStyleUrl (key, apikey) {
    var url =
      'https://basemaps-api.arcgis.com/arcgis/rest/services/styles/' +
      key +
      '?type=style';
    if (apikey) {
      url = url + '&apiKey=' + apikey;
    }
    return url;
  }

  /*
    utilities to communicate with custom user styles via an ITEM ID or SERVICE URL
    used primarily by VectorTileLayer.js
  */
  function loadStyle (idOrUrl, options, callback) {
    var httpRegex = /^https?:\/\//;
    var serviceRegex = /\/VectorTileServer\/?$/;

    if (httpRegex.test(idOrUrl) && serviceRegex.test(idOrUrl)) {
      var serviceUrl = idOrUrl;
      loadStyleFromService(serviceUrl, options, callback);
    } else {
      var itemId = idOrUrl;
      loadStyleFromItem(itemId, options, callback);
    }
  }

  function loadService (serviceUrl, options, callback) {
    var params = options.token ? { token: options.token } : {};
    esriLeaflet.request(serviceUrl, params, callback);
  }

  function loadItem (itemId, options, callback) {
    var params = options.token ? { token: options.token } : {};
    var url = '';

    if (options.useCustomUrlOrPath) {
      url = options.baseUrl + '/' + itemId;
    } else {
      url = options.portalUrl +
      '/sharing/rest/content/items/' +
      itemId;
    }

    esriLeaflet.request(url, params, callback);
  }

  function loadStyleFromItem (itemId, options, callback) {
    var itemStyleUrl = '';

    if (options.useCustomUrlOrPath) {
      itemStyleUrl = options.baseUrl + '/' + itemId + '/' + options.stylePath;
    } else {
      itemStyleUrl = options.portalUrl +
      '/sharing/rest/content/items/' +
      itemId +
      '/resources/styles/root.json';
    }

    loadStyleFromUrl(itemStyleUrl, options, function (error, style) {
      if (error) {
        loadItem(itemId, options, function (error, item) {
          if (error) {
            console.error(error);
            callback(error);
            return;
          }
          loadStyleFromService(item.url, options, callback);
        });
      } else {
        loadItem(itemId, options, function (error, item) {
          if (error) {
            console.error(error);
            callback(error);
            return;
          }
          loadService(item.url, options, function (error, service) {
            callback(error, style, itemStyleUrl, service, item.url);
          });
        });
      }
    });
  }

  function loadStyleFromService (serviceUrl, options, callback) {
    loadService(serviceUrl, options, function (error, service) {
      if (error) {
        console.error(error);
      }

      var sanitizedServiceUrl = serviceUrl;
      // a trailing "/" may create invalid paths
      if (serviceUrl.charAt(serviceUrl.length - 1) === '/') {
        sanitizedServiceUrl = serviceUrl.slice(0, serviceUrl.length - 1);
      }

      var defaultStylesUrl;
      // inadvertently inserting more than 1 adjacent "/" may create invalid paths
      if (service.defaultStyles.charAt(0) === '/') {
        defaultStylesUrl =
          sanitizedServiceUrl + service.defaultStyles + '/root.json';
      } else {
        defaultStylesUrl =
          sanitizedServiceUrl + '/' + service.defaultStyles + '/root.json';
      }

      loadStyleFromUrl(defaultStylesUrl, options, function (error, style) {
        if (error) {
          console.error(error);
        }
        callback(null, style, defaultStylesUrl, service, serviceUrl);
      });
    });
  }

  function loadStyleFromUrl (styleUrl, options, callback) {
    var params = options.token ? { token: options.token } : {};
    esriLeaflet.request(styleUrl, params, callback);
  }

  function formatStyle (style, styleUrl, metadata, token) {
    // transforms style object in place and also returns it

    // modify each source in style.sources
    var sourcesKeys = Object.keys(style.sources);
    for (var sourceIndex = 0; sourceIndex < sourcesKeys.length; sourceIndex++) {
      var source = style.sources[sourcesKeys[sourceIndex]];

      // if a relative path is referenced, the default style can be found in a standard location
      if (source.url.indexOf('http') === -1) {
        source.url = styleUrl.replace('/resources/styles/root.json', '');
      }

      // a trailing "/" may create invalid paths
      if (source.url.charAt(source.url.length - 1) === '/') {
        source.url = source.url.slice(0, source.url.length - 1);
      }

      // add tiles property if missing
      if (!source.tiles) {
        // right now ArcGIS Pro published vector services have a slightly different signature
        // the '/' is needed in the URL string concatenation below for source.tiles
        if (metadata.tiles && metadata.tiles[0].charAt(0) !== '/') {
          metadata.tiles[0] = '/' + metadata.tiles[0];
        }

        source.tiles = [source.url + metadata.tiles[0]];
      }

      // some VectorTileServer endpoints may default to returning f=html,
      // specify f=json to account for that behavior
      source.url += '?f=json';

      // add the token to the source url and tiles properties as a query param
      source.url += token ? '&token=' + token : '';
      source.tiles[0] += token ? '?token=' + token : '';

      // add minzoom and maxzoom to each source based on the service metadata
      source.minzoom = metadata.tileInfo.lods[0].level;
      source.maxzoom =
        metadata.tileInfo.lods[metadata.tileInfo.lods.length - 1].level;
    }

    // add the attribution and copyrightText properties to the last source in style.sources based on the service metadata
    var lastSource = style.sources[sourcesKeys[sourcesKeys.length - 1]];
    lastSource.attribution = metadata.copyrightText || '';
    lastSource.copyrightText = metadata.copyrightText || '';

    // if any layer in style.layers has a layout.text-font property (it will be any array of strings) remove all items in the array after the first
    for (var layerIndex = 0; layerIndex < style.layers.length; layerIndex++) {
      var layer = style.layers[layerIndex];
      if (
        layer.layout &&
        layer.layout['text-font'] &&
        layer.layout['text-font'].length > 1
      ) {
        layer.layout['text-font'] = [layer.layout['text-font'][0]];
      }
    }

    if (style.sprite && style.sprite.indexOf('http') === -1) {
      // resolve absolute URL for style.sprite
      style.sprite = styleUrl.replace(
        'styles/root.json',
        style.sprite.replace('../', '')
      );

      // add the token to the style.sprite property as a query param
      style.sprite += token ? '?token=' + token : '';
    }

    if (style.glyphs && style.glyphs.indexOf('http') === -1) {
      // resolve absolute URL for style.glyphs
      style.glyphs = styleUrl.replace(
        'styles/root.json',
        style.glyphs.replace('../', '')
      );

      // add the token to the style.glyphs property as a query param
      style.glyphs += token ? '?token=' + token : '';
    }

    return style;
  }

  /*
    utility to assist with dynamic attribution data
    used primarily by VectorBasemapLayer.js
  */
  function getAttributionData (url, map) {
    if (esriLeaflet.Support.cors) {
      esriLeaflet.request(url, {}, function (error, attributions) {
        if (error) {
          return;
        }
        map._esriAttributions = map._esriAttributions || [];
        for (var c = 0; c < attributions.contributors.length; c++) {
          var contributor = attributions.contributors[c];

          for (var i = 0; i < contributor.coverageAreas.length; i++) {
            var coverageArea = contributor.coverageAreas[i];
            var southWest = leaflet.latLng(coverageArea.bbox[0], coverageArea.bbox[1]);
            var northEast = leaflet.latLng(coverageArea.bbox[2], coverageArea.bbox[3]);
            map._esriAttributions.push({
              attribution: contributor.attribution,
              score: coverageArea.score,
              bounds: leaflet.latLngBounds(southWest, northEast),
              minZoom: coverageArea.zoomMin,
              maxZoom: coverageArea.zoomMax
            });
          }
        }

        map._esriAttributions.sort(function (a, b) {
          return b.score - a.score;
        });

        // pass the same argument as the map's 'moveend' event
        var obj = { target: map };
        esriLeaflet.Util._updateMapAttribution(obj);
      });
    }
  }

  /*
    utility to check if a service's tileInfo spatial reference is in Web Mercator
    used primarily by VectorTileLayer.js
  */
  const WEB_MERCATOR_WKIDS = [3857, 102100, 102113];

  function isWebMercator (wkid) {
    return WEB_MERCATOR_WKIDS.indexOf(wkid) >= 0;
  }

  var MapboxGLJSLayer = leaflet.Layer.extend({
    options: {
      updateInterval: 32,
      // How much to extend the overlay view (relative to map size)
      // e.g. 0.1 would be 10% of map view in each direction
      padding: 0.1,
      // whether or not to register the mouse and keyboard
      // events on the mapbox overlay
      interactive: false,
      opacity: 1
    },

    initialize: function (options) {
      leaflet.setOptions(this, options);

      // setup throttling the update event when panning
      this._throttledUpdate = leaflet.Util.throttle(
        this._update,
        this.options.updateInterval,
        this
      );
    },

    onAdd: function (map) {
      if (!this._container) {
        this._initContainer();
      }

      this.getPane().appendChild(this._container);

      this._initGL();

      this._offset = this._map.containerPointToLayerPoint([0, 0]);

      // work around https://github.com/mapbox/mapbox-gl-leaflet/issues/47
      if (map.options.zoomAnimation) {
        leaflet.DomEvent.on(
          map._proxy,
          leaflet.DomUtil.TRANSITION_END,
          this._transitionEnd,
          this
        );
      }
    },

    onRemove: function (map) {
      if (this._map._proxy && this._map.options.zoomAnimation) {
        leaflet.DomEvent.off(
          this._map._proxy,
          leaflet.DomUtil.TRANSITION_END,
          this._transitionEnd,
          this
        );
      }

      this.getPane().removeChild(this._container);
      this._glMap.remove();
      this._glMap = null;
    },

    getEvents: function () {
      return {
        move: this._throttledUpdate, // sensibly throttle updating while panning
        zoomanim: this._animateZoom, // applys the zoom animation to the <canvas>
        zoom: this._pinchZoom, // animate every zoom event for smoother pinch-zooming
        zoomstart: this._zoomStart, // flag starting a zoom to disable panning
        zoomend: this._zoomEnd
      };
    },

    getMapboxMap: function () {
      return this._glMap;
    },

    getCanvas: function () {
      return this._glMap.getCanvas();
    },

    getSize: function () {
      return this._map.getSize().multiplyBy(1 + this.options.padding * 2);
    },

    getOpacity: function () {
      return this.options.opacity;
    },

    setOpacity: function (opacity) {
      this.options.opacity = opacity;
      this._container.style.opacity = opacity;
    },

    getBounds: function () {
      var halfSize = this.getSize().multiplyBy(0.5);
      var center = this._map.latLngToContainerPoint(this._map.getCenter());
      return leaflet.latLngBounds(
        this._map.containerPointToLatLng(center.subtract(halfSize)),
        this._map.containerPointToLatLng(center.add(halfSize))
      );
    },

    getContainer: function () {
      return this._container;
    },

    _initContainer: function () {
      var container = (this._container = leaflet.DomUtil.create(
        'div',
        'leaflet-gl-layer'
      ));

      var size = this.getSize();
      var offset = this._map.getSize().multiplyBy(this.options.padding);
      container.style.width = size.x + 'px';
      container.style.height = size.y + 'px';
      container.style.position = 'absolute';
      container.style.opacity = this.options.opacity;
      var topLeft = this._map.containerPointToLayerPoint([0, 0]).subtract(offset);

      leaflet.DomUtil.setPosition(container, topLeft);
    },

    _initGL: function () {
      var center = this._map.getCenter();

      var options = leaflet.extend({}, this.options, {
        container: this._container,
        center: [center.lng, center.lat],
        zoom: this._map.getZoom() - 1,
        attributionControl: false
      });

      this._glMap = new mapboxgl__default["default"].Map(options);

      // Fire event for MapboxGL "styledata" event.
      this._glMap.once('styledata', function (res) {
        this.fire('styleLoaded');
      }.bind(this));

      // allow GL base map to pan beyond min/max latitudes
      this._glMap.transform.latRange = null;
      this._transformGL(this._glMap);

      if (this._glMap._canvas.canvas) {
        // older versions of mapbox-gl surfaced the canvas differently
        this._glMap._actualCanvas = this._glMap._canvas.canvas;
      } else {
        this._glMap._actualCanvas = this._glMap._canvas;
      }

      // treat child <canvas> element like L.ImageOverlay
      var canvas = this._glMap._actualCanvas;
      leaflet.DomUtil.addClass(canvas, 'leaflet-image-layer');
      leaflet.DomUtil.addClass(canvas, 'leaflet-zoom-animated');
      if (this.options.interactive) {
        leaflet.DomUtil.addClass(canvas, 'leaflet-interactive');
      }
      if (this.options.className) {
        leaflet.DomUtil.addClass(canvas, this.options.className);
      }
    },

    _update: function (e) {
      // update the offset so we can correct for it later when we zoom
      this._offset = this._map.containerPointToLayerPoint([0, 0]);

      if (this._zooming) {
        return;
      }

      var size = this.getSize();
      var container = this._container;
      var gl = this._glMap;
      var offset = this._map.getSize().multiplyBy(this.options.padding);
      var topLeft = this._map.containerPointToLayerPoint([0, 0]).subtract(offset);

      leaflet.DomUtil.setPosition(container, topLeft);

      this._transformGL(gl);

      if (gl.transform.width !== size.x || gl.transform.height !== size.y) {
        container.style.width = size.x + 'px';
        container.style.height = size.y + 'px';
        if (gl._resize !== null && gl._resize !== undefined) {
          gl._resize();
        } else {
          gl.resize();
        }
      } else {
        // older versions of mapbox-gl surfaced update publicly
        if (gl._update !== null && gl._update !== undefined) {
          gl._update();
        } else {
          gl.update();
        }
      }
    },

    _transformGL: function (gl) {
      var center = this._map.getCenter();

      // gl.setView([center.lat, center.lng], this._map.getZoom() - 1, 0);
      // calling setView directly causes sync issues because it uses requestAnimFrame

      var tr = gl.transform;
      tr.center = mapboxgl__default["default"].LngLat.convert([center.lng, center.lat]);
      tr.zoom = this._map.getZoom() - 1;
    },

    // update the map constantly during a pinch zoom
    _pinchZoom: function (e) {
      this._glMap.jumpTo({
        zoom: this._map.getZoom() - 1,
        center: this._map.getCenter()
      });
    },

    // borrowed from L.ImageOverlay
    // https://github.com/Leaflet/Leaflet/blob/master/src/layer/ImageOverlay.js#L139-L144
    _animateZoom: function (e) {
      var scale = this._map.getZoomScale(e.zoom);
      var padding = this._map.getSize().multiplyBy(this.options.padding * scale);
      var viewHalf = this.getSize()._divideBy(2);
      // corrections for padding (scaled), adapted from
      // https://github.com/Leaflet/Leaflet/blob/master/src/map/Map.js#L1490-L1508
      var topLeft = this._map
        .project(e.center, e.zoom)
        ._subtract(viewHalf)
        ._add(this._map._getMapPanePos().add(padding))
        ._round();
      var offset = this._map
        .project(this._map.getBounds().getNorthWest(), e.zoom)
        ._subtract(topLeft);

      leaflet.DomUtil.setTransform(
        this._glMap._actualCanvas,
        offset.subtract(this._offset),
        scale
      );
    },

    _zoomStart: function (e) {
      this._zooming = true;
    },

    _zoomEnd: function () {
      var scale = this._map.getZoomScale(this._map.getZoom());

      leaflet.DomUtil.setTransform(
        this._glMap._actualCanvas,
        null,
        scale
      );

      this._zooming = false;

      this._update();
    },

    _transitionEnd: function (e) {
      leaflet.Util.requestAnimFrame(function () {
        var zoom = this._map.getZoom();
        var center = this._map.getCenter();
        var offset = this._map.latLngToContainerPoint(
          this._map.getBounds().getNorthWest()
        );

        // reset the scale and offset
        leaflet.DomUtil.setTransform(this._glMap._actualCanvas, offset, 1);

        // enable panning once the gl map is ready again
        this._glMap.once(
          'moveend',
          leaflet.Util.bind(function () {
            this._zoomEnd();
          }, this)
        );

        // update the map position
        this._glMap.jumpTo({
          center: center,
          zoom: zoom - 1
        });
      }, this);
    }
  });

  function mapboxGLJSLayer (options) {
    return new MapboxGLJSLayer(options);
  }

  var VectorBasemapLayer = leaflet.Layer.extend({
    options: {
      key: 'ArcGIS:Streets' // default style key enum if none provided
    },

    /**
     * Populates "this.options" to be used in the rest of the module.
     *
     * @param {string} key
     * @param {object} options optional
     */
    initialize: function (key, options) {
      if (options) {
        leaflet.setOptions(this, options);
      }

      // support outdated casing apiKey of apikey
      if (this.options.apiKey) {
        this.options.apikey = this.options.apiKey;
      }

      // if token is passed in, use it as an apiKey
      if (this.options.token) {
        this.options.apikey = this.options.token;
      }

      // If no API Key or token is required:
      if (!(this.options.apikey || this.options.token)) {
        throw new Error('API Key or token is required for vectorBasemapLayer.');
      }

      // set key onto "this.options" for use elsewhere in the module.
      if (key) {
        this.options.key = key;
      }

      // this.options has been set, continue on to create the layer:
      this._createLayer();
    },

    /**
     * Creates the mapboxGLJSLayer given using "this.options"
     */
    _createLayer: function () {
      var styleUrl = getBasemapStyleUrl(this.options.key, this.options.apikey);

      this._mapboxGL = mapboxGLJSLayer({
        style: styleUrl,
        pane: this.options.pane,
        opacity: this.options.opacity
      });

      this._ready = true;
      this.fire('ready', {}, true);

      this._mapboxGL.on('styleLoaded', function (res) {
        this._setupAttribution();
      }.bind(this));
    },

    _setupAttribution: function () {
      var map = this._map;
      // Set attribution
      esriLeaflet.Util.setEsriAttribution(map);

      if (this.options.key.length === 32) {
        // this is an itemId
        var sources = this._mapboxGL.getMapboxMap().style.stylesheet.sources;
        var allAttributions = [];
        Object.keys(sources).forEach(function (key) {
          allAttributions.push(sources[key].attribution);
          if (sources[key].copyrightText && sources[key].copyrightText && sources[key].copyrightText !== '' && sources[key].attribution !== sources[key].copyrightText) {
            allAttributions.push(sources[key].copyrightText);
          }
        });

        map.attributionControl.addAttribution('<span class="">' + allAttributions.join(', ') + '</span>');
      } else {
        // this is an enum
        if (!this.options.attributionUrls) {
          this.options.attributionUrls = this._getAttributionUrls(this.options.key);
        }

        if (this._map && this.options.attributionUrls) {
          if (this._map.attributionControl) {
            for (
              let index = 0;
              index < this.options.attributionUrls.length;
              index++
            ) {
              const attributionUrl = this.options.attributionUrls[index];
              getAttributionData(attributionUrl, map);
            }

            map.attributionControl.addAttribution(
              '<span class="esri-dynamic-attribution"></span>'
            );
          }
          esriLeaflet.Util._updateMapAttribution({ target: this._map });
        }
      }
    },

    /**
     * Given a key, return the attribution url(s).
     * @param {string} key
     */
    _getAttributionUrls: function (key) {
      if (key.indexOf('OSM:') === 0) {
        return ['https://static.arcgis.com/attribution/Vector/OpenStreetMap_v2'];
      } else if (key.indexOf('ArcGIS:Imagery') === 0) {
        return [
          'https://static.arcgis.com/attribution/World_Imagery',
          'https://static.arcgis.com/attribution/Vector/World_Basemap_v2'
        ];
      }

      // default:
      return ['https://static.arcgis.com/attribution/Vector/World_Basemap_v2'];
    },

    onAdd: function (map) {
      this._map = map;

      this._initPane();

      if (this._ready) {
        this._asyncAdd();
      } else {
        this.once(
          'ready',
          function () {
            this._asyncAdd();
          },
          this
        );
      }
    },

    _initPane: function () {
      // if the layer is a "label" layer, should use the "esri-label" pane.
      if (!this.options.pane) {
        if (this.options.key.indexOf(':Labels') > -1) {
          this.options.pane = 'esri-labels';
        } else {
          this.options.pane = 'tilePane';
        }
      }

      if (!this._map.getPane(this.options.pane)) {
        var pane = this._map.createPane(this.options.pane);
        pane.style.pointerEvents = 'none';
        pane.style.zIndex = this.options.pane === 'esri-labels' ? 550 : 500;
      }
    },

    onRemove: function (map) {
      map.off('moveend', esriLeaflet.Util._updateMapAttribution);
      map.removeLayer(this._mapboxGL);

      if (map.attributionControl) {
        var element = document.getElementsByClassName('esri-dynamic-attribution');

        if (element && element.length > 0) {
          var vectorAttribution = element[0].outerHTML;
          // this doesn't work, not sure why.
          map.attributionControl.removeAttribution(vectorAttribution);
        }
      }
    },

    _asyncAdd: function () {
      var map = this._map;
      map.on('moveend', esriLeaflet.Util._updateMapAttribution);
      this._mapboxGL.addTo(map, this);
    }
  });

  function vectorBasemapLayer (key, options) {
    return new VectorBasemapLayer(key, options);
  }

  var VectorTileLayer = leaflet.Layer.extend({
    options: {
      // if pane is not provided, default to LeafletJS's overlayPane
      // https://leafletjs.com/reference.html#map-pane
      pane: 'overlayPane',

      // if portalUrl is not provided, default to ArcGIS Online
      portalUrl: 'https://www.arcgis.com',

      // flag to use baseUrl and stylePath options (defaults below)
      useCustomUrlOrPath: false,

      // if baseUrl is not provided, default path to items on ArcGIS Online
      baseUrl: 'https://www.arcgis.com/sharing/rest/content/items',

      // if stylePath is not provided, default ArcGIS Online stylePath
      stylePath: 'resources/styles/root.json'
    },

    /**
     * Populates "this.options" to be used in the rest of the module and creates the layer instance.
     *
     * @param {string} key an ITEM ID or SERVICE URL
     * @param {object} options optional
     */
    initialize: function (key, options) {
      if (options) {
        leaflet.setOptions(this, options);
      }

      // support outdated casing apiKey of apikey
      if (this.options.apiKey) {
        this.options.apikey = this.options.apiKey;
      }

      // if apiKey is passed in, use it as a token
      // (opposite from VectorBasemapLayer.js)
      if (this.options.apikey) {
        this.options.token = this.options.apikey;
      }

      // if no key passed in
      if (!key) {
        throw new Error('An ITEM ID or SERVICE URL is required for vectorTileLayer.');
      }

      // set key onto "this.options" for use elsewhere in the module.
      if (key) {
        this.options.key = key;
      }

      // this.options has been set, continue on to create the layer:
      this._createLayer();
    },

    /**
     * Creates the mapboxGLJSLayer given using "this.options"
     */
    _createLayer: function () {
      loadStyle(
        this.options.key,
        this.options,
        function (error, style, styleUrl, service) {
          if (error) {
            if (this.options.errorCallback) {
              this.options.errorCallback(error);
              return;
            } else {
              throw new Error(error);
            }
          }

          if (!isWebMercator(service.tileInfo.spatialReference.wkid)) {
            console.warn(
              'This layer is not guaranteed to display properly because its service does not use the Web Mercator projection. The "tileInfo.spatialReference" property is:',
              service.tileInfo.spatialReference,
              '\nMore information is available at https://docs.mapbox.com/help/glossary/projection/ and https://github.com/Esri/esri-leaflet-vector/issues/94.'
            );
          }

          // once style object is loaded it must be transformed to be compliant with mapboxGLJSLayer
          style = formatStyle(style, styleUrl, service, this.options.token);

          // if a custom attribution was not provided in the options,
          // then attempt to rely on the attribution of the last source in the style object
          // and add it to the map's attribution control
          // (otherwise it would have already been added by leaflet to the attribution control)
          if (!this.getAttribution()) {
            var sourcesKeys = Object.keys(style.sources);
            this.options.attribution = style.sources[sourcesKeys[sourcesKeys.length - 1]].attribution;
            if (this._map && this._map.attributionControl) {
              // NOTE: if attribution is an empty string (or otherwise falsy) at this point it would not appear in the attribution control
              this._map.attributionControl.addAttribution(this.getAttribution());
            }
          }

          // additionally modify the style object with the user's optional style override function
          if (this.options.style && typeof this.options.style === 'function') {
            style = this.options.style(style);
          }

          this._mapboxGL = mapboxGLJSLayer({
            style: style,
            pane: this.options.pane,
            opacity: this.options.opacity
          });

          this._ready = true;
          this.fire('ready', {}, true);
        }.bind(this)
      );
    },

    onAdd: function (map) {
      this._map = map;

      if (this._ready) {
        this._asyncAdd();
      } else {
        this.once(
          'ready',
          function () {
            this._asyncAdd();
          },
          this
        );
      }
    },

    onRemove: function (map) {
      if (this._mapboxGL) {
        map.removeLayer(this._mapboxGL);
      }
    },

    _asyncAdd: function () {
      var map = this._map;
      this._mapboxGL.addTo(map, this);
    }
  });

  function vectorTileLayer (key, options) {
    return new VectorTileLayer(key, options);
  }

  exports.VERSION = version;
  exports.VectorBasemapLayer = VectorBasemapLayer;
  exports.VectorTileLayer = VectorTileLayer;
  exports.vectorBasemapLayer = vectorBasemapLayer;
  exports.vectorTileLayer = vectorTileLayer;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=esri-leaflet-vector-debug.js.map
