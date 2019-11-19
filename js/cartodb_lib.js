var CartoDbLib = CartoDbLib || {};
var CartoDbLib = {

  // parameters to be defined on initialize() 
  map_centroid: [],
  defaultZoom: 9,
  layerUrl: '',
  tableName: '',
  userName: '',
  fields: '',
  listOrderBy: '',
  googleApiKey: '',
  recordName: '',
  recordNamePlural: '',

  // internal properties
  geoSearch: '',
  whereClause: '',
  radius: '',
  resultsCount: 0,
  currentPinpoint: null,
  lastClickedLayer: null,

  initialize: function(options){

    options = options || {};

    CartoDbLib.map_centroid = options.map_centroid || [41.881832, -87.623177],
    CartoDbLib.defaultZoom = options.defaultZoom || 9,
    CartoDbLib.layerUrl = options.layerUrl || "",
    CartoDbLib.tableName = options.tableName || "",
    CartoDbLib.userName = options.userName || "",
    CartoDbLib.fields = options.fields || "",
    CartoDbLib.listOrderBy = options.listOrderBy || "",
    CartoDbLib.googleApiKey = options.googleApiKey || "",
    CartoDbLib.recordName = options.recordName || "result",
    CartoDbLib.recordNamePlural = options.recordNamePlural || "results",
    CartoDbLib.radius = options.radius || 805,    

    //reset filters
    $("#search-address").val(CartoDbLib.convertToPlainString($.address.parameter('address')));

    var loadRadius = CartoDbLib.convertToPlainString($.address.parameter('radius'));
    if (loadRadius != "") 
        $("#search-radius").val(loadRadius);
    else 
        $("#search-radius").val(CartoDbLib.radius);

    $(":checkbox").prop("checked", "checked");

    var num = $.address.parameter('modal_id');

    if (typeof num !== 'undefined') {
      var sql = new cartodb.SQL({ user: CartoDbLib.userName });
      sql.execute("SELECT " + CartoDbLib.fields + " FROM " + CartoDbLib.tableName + " WHERE id = " + num)
      .done(function(data) {
        CartoDbLib.modalPop(data.rows[0]);
      });
    }

    geocoder = new google.maps.Geocoder();
    // initiate leaflet map
    if (!CartoDbLib.map) {
      CartoDbLib.map = new L.Map('mapCanvas', {
        center: CartoDbLib.map_centroid,
        zoom: CartoDbLib.defaultZoom,
        scrollWheelZoom: false
      });

      CartoDbLib.google = new L.Google('ROADMAP', {animate: false});

      CartoDbLib.map.addLayer(CartoDbLib.google);

      //add hover info control
      CartoDbLib.info = L.control({position: 'bottomleft'});

      CartoDbLib.info.onAdd = function (map) {
          this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
          this.update();
          return this._div;
      };

      // method that we will use to update the control based on feature properties passed
      var hover_template;
      $.get( "/templates/hover.ejs?1", function( template ) {
        hover_template = template;
      });
      CartoDbLib.info.update = function (props) {
        if (props) {
          this._div.innerHTML = ejs.render(hover_template, {obj: props});
        }
        else {
          this._div.innerHTML = 'Hover over a ' + CartoDbLib.recordName;
        }
      };

      CartoDbLib.info.clear = function(){
        this._div.innerHTML = 'Hover over a ' + CartoDbLib.recordName;
      };

      //add results control
      CartoDbLib.results_div = L.control({position: 'topright'});

      CartoDbLib.results_div.onAdd = function (map) {
        this._div = L.DomUtil.create('div', 'results-count');
        this._div.innerHTML = "";
        return this._div;
      };

      CartoDbLib.results_div.update = function (count){
        var recname = CartoDbLib.recordNamePlural;
        if (count == 1) {
            recname = CartoDbLib.recordName;
        }

        this._div.innerHTML = count.toLocaleString('en') + ' ' + recname + ' found';
      };

      CartoDbLib.results_div.addTo(CartoDbLib.map);
      CartoDbLib.info.addTo(CartoDbLib.map);
      
      CartoDbLib.doSearch();
    }
  },

  doSearch: function() {
    CartoDbLib.clearSearch();
    var address = $("#search-address").val();
    CartoDbLib.radius = $("#search-radius").val();

    if (CartoDbLib.radius == null && address != "") {
      CartoDbLib.radius = 805;
    }

    if (address != "") {

      geocoder.geocode( { 'address': address }, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
          CartoDbLib.currentPinpoint = [results[0].geometry.location.lat(), results[0].geometry.location.lng()];
          $.address.parameter('address', encodeURIComponent(address));
          $.address.parameter('radius', CartoDbLib.radius);
          CartoDbLib.address = address;
          CartoDbLib.createSQL(); // Must call create SQL before setting parameters.
          CartoDbLib.setZoom();
          CartoDbLib.addIcon();
          CartoDbLib.addCircle();
          CartoDbLib.renderMap();
          CartoDbLib.renderList();
          CartoDbLib.getResults();
        }
        else {
          alert("We could not find your address: " + status);
        }
      });
    }
    else { //search without geocoding callback
      CartoDbLib.map.setView(new L.LatLng( CartoDbLib.map_centroid[0], CartoDbLib.map_centroid[1] ), CartoDbLib.defaultZoom)
      CartoDbLib.createSQL(); // Must call create SQL before setting parameters.
      CartoDbLib.renderMap();
      CartoDbLib.renderList();
      CartoDbLib.getResults();
    }

  },

  renderMap: function() {
      var layerOpts = {
        user_name: CartoDbLib.userName,
        type: 'cartodb',
        cartodb_logo: false,
        sublayers: [
          {
            sql: "SELECT * FROM " + CartoDbLib.tableName + CartoDbLib.whereClause,
            cartocss: $('#maps-styles').html().trim(),
            interactivity: CartoDbLib.fields
          }
        ]
      }

      CartoDbLib.dataLayer = cartodb.createLayer(CartoDbLib.map, layerOpts, { https: true })
        .addTo(CartoDbLib.map)
        .done(function(layer) {
          CartoDbLib.sublayer = layer.getSubLayer(0);
          CartoDbLib.sublayer.setInteraction(true);
          CartoDbLib.sublayer.on('featureOver', function(e, latlng, pos, data, subLayerIndex) {
            $('#mapCanvas div').css('cursor','pointer');
            CartoDbLib.info.update(data);
          })
          CartoDbLib.sublayer.on('featureOut', function(e, latlng, pos, data, subLayerIndex) {
            $('#mapCanvas div').css('cursor','inherit');
            CartoDbLib.info.clear();
          })
          CartoDbLib.sublayer.on('featureClick', function(e, latlng, pos, data) {
              CartoDbLib.modalPop(data);
          })
          CartoDbLib.sublayer.on('error', function(err) {
            console.log('error: ' + err);
          })
        }).on('error', function(e) {
          console.log('ERROR')
          console.log(e)
        });
  },

  renderList: function() {
    var sql = new cartodb.SQL({ user: CartoDbLib.userName });
    var results = $('#results-list');

    if ((CartoDbLib.whereClause == ' WHERE the_geom is not null AND ') || (CartoDbLib.whereClause == ' WHERE the_geom is not null ')) {
      CartoDbLib.whereClause = '';
    }

    var sortClause = '';
    if (CartoDbLib.listOrderBy != '')
      sortClause = 'ORDER BY ' + CartoDbLib.listOrderBy;

    results.empty();
    sql.execute("SELECT " + CartoDbLib.fields + " FROM " + CartoDbLib.tableName + CartoDbLib.whereClause + sortClause)
      .done(function(listData) {
        var obj_array = listData.rows;

        // console.log(obj_array);
        if (listData.rows.length == 0) {
          results.append("<p class='no-results'>No results. Please broaden your search.</p>");
        }
        else {
          var row_content;
          $.get( "/templates/table-row.ejs?7", function( template ) {
              for (idx in obj_array) {

                row_content = ejs.render(template, {obj: obj_array[idx]});

                results.append(row_content);
              }
            });
          }
    }).error(function(errors) {
      console.log("errors:" + errors);
    });
  },

  getResults: function() {
    var sql = new cartodb.SQL({ user: CartoDbLib.userName });

    sql.execute("SELECT count(*) FROM " + CartoDbLib.tableName + CartoDbLib.whereClause)
      .done(function(data) {
        CartoDbLib.resultsCount = data.rows[0]["count"];
        CartoDbLib.results_div.update(CartoDbLib.resultsCount);

        var recname = CartoDbLib.recordNamePlural;
        if (CartoDbLib.resultsCount == 1) {
            recname = CartoDbLib.recordName;
        }

        $('#list-result-count').html(CartoDbLib.resultsCount.toLocaleString('en') + ' ' + recname + ' found')
      }
    );
  },

  modalPop: function(data) {

    var modal_content;
    $.get( "/templates/popup.ejs?8", function( template ) {
        modal_content = ejs.render(template, {obj: data});
        $('#modal-pop').modal();
        $('#modal-main').html(modal_content);
        $.address.parameter('modal_id', data.id);
      });
  },

  clearSearch: function(){
    if (CartoDbLib.sublayer) {
      CartoDbLib.sublayer.remove();
    }
    if (CartoDbLib.centerMark)
      CartoDbLib.map.removeLayer( CartoDbLib.centerMark );
    if (CartoDbLib.radiusCircle)
      CartoDbLib.map.removeLayer( CartoDbLib.radiusCircle );
  },

  createSQL: function() {
     // Devise SQL calls for geosearch and language search.
    var address = $("#search-address").val();

    if(CartoDbLib.currentPinpoint != null && address != '') {
      CartoDbLib.geoSearch = " AND ST_DWithin(ST_SetSRID(ST_POINT(" + CartoDbLib.currentPinpoint[1] + ", " + CartoDbLib.currentPinpoint[0] + "), 4326)::geography, the_geom::geography, " + CartoDbLib.radius + ")";
    }
    else {
      CartoDbLib.geoSearch = ''
    }

    CartoDbLib.whereClause = " WHERE the_geom is not null ";

    //-----custom filters-----

    if ($('#start-date').val())
      CartoDbLib.whereClause += " AND created_date >= '" + $('#start-date').val() + "'";
    if ($('#end-date').val())
      CartoDbLib.whereClause += " AND created_date <= '" + $('#end-date').val() + "'";

    // this logic is a bit funny since we're keying off the presence of a value instead of a type column
    if ( $("#cbType1").is(':checked') && $("#cbType2").is(':checked'))
      CartoDbLib.whereClause += " AND (docket_number is not null OR docket_number is null)";
    else {
      if ( $("#cbType1").is(':checked'))
        CartoDbLib.whereClause += " AND docket_number is not null ";
      if ( $("#cbType2").is(':checked'))
        CartoDbLib.whereClause += " AND docket_number is null ";
    }
    // -----end of custom filters-----

    if (CartoDbLib.geoSearch != "") {
      CartoDbLib.whereClause += CartoDbLib.geoSearch;
    }

    // console.log(CartoDbLib.whereClause)
  },

  setZoom: function() {
    var zoom = '';
    if (CartoDbLib.radius >= 8050) zoom = 12; // 5 miles
    else if (CartoDbLib.radius >= 3220) zoom = 13; // 2 miles
    else if (CartoDbLib.radius >= 1610) zoom = 14; // 1 mile
    else if (CartoDbLib.radius >= 805) zoom = 15; // 1/2 mile
    else if (CartoDbLib.radius >= 400) zoom = 16; // 1/4 mile
    else zoom = 16;

    CartoDbLib.map.setView(new L.LatLng( CartoDbLib.currentPinpoint[0], CartoDbLib.currentPinpoint[1] ), zoom)
  },

  addIcon: function() {
    CartoDbLib.centerMark = new L.Marker(CartoDbLib.currentPinpoint, { icon: (new L.Icon({
            iconUrl: '/img/blue-pushpin.png',
            iconSize: [32, 32],
            iconAnchor: [10, 32]
    }))});

    CartoDbLib.centerMark.addTo(CartoDbLib.map);
  },

  addCircle: function() {
    CartoDbLib.radiusCircle = new L.circle(CartoDbLib.currentPinpoint, CartoDbLib.radius, {
        fillColor:'#1d5492',
        fillOpacity:'0.1',
        stroke: false,
        clickable: false
    });

    CartoDbLib.radiusCircle.addTo(CartoDbLib.map);
  },

  //converts a slug or query string in to readable text
  convertToPlainString: function(text) {
    if (text == undefined) return '';
    return decodeURIComponent(text);
  },

  // -----custom functions-----
  getColor: function(docket_number){
    if (docket_number != null) return 'red';
    return 'yellow';
  },
  // -----end custom functions-----

}