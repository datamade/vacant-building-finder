/*!
 * Searchable Map Template with Google Fusion Tables
 * http://derekeder.com/searchable_map_template/
 *
 * Copyright 2012, Derek Eder
 * Licensed under the MIT license.
 * https://github.com/derekeder/FusionTable-Map-Template/wiki/License
 *
 * Date: 2/31/2013
 *
 */

var MapsLib = MapsLib || {};
var MapsLib = {

  //Setup section - put your Fusion Table details here
  //Using the v1 Fusion Tables API. See https://developers.google.com/fusiontables/docs/v1/migration_guide for more info

  //the encrypted Table ID of your Fusion Table (found under File => About)
  //NOTE: numeric IDs will be depricated soon
  fusionTableId: "1fK7H4ZDsWT-9sa09CjuJft3UBzxGcQlyPRBygEc", //main table for building data
  
  povertyTableId: "15FyZq0hRcxUg9uCO_2DZm6vLvxKGpEwaMHs00lw",
  unemploymentTableId: "1YB3wtRv-UZXkJ8N1T83MDmOvA1ccuP_M1vHNOQs",
  populationTableId: "1IiCZoS5RciFwRJF71UWOMRYFfhcbKs-PbZTqF80",
  medianIncomeId: "14kEdO1R9-j0VELDdIDoX3rhhFyiv9WdgDYj79zg",

  violationsId: "1f4RAV8-jliazqW49fkBgFX18AgOzudF4GePRVrM",

  //*New Fusion Tables Requirement* API key. found at https://code.google.com/apis/console/
  //*Important* this key is for demonstration purposes. please register your own.
  googleApiKey:       "AIzaSyAcsnDc7_YZskPj4ep3jT_fkpB3HI_1a98",

  //name of the location column in your Fusion Table.
  //NOTE: if your location column name has spaces in it, surround it with single quotes
  //example: locationColumn:     "'my location'",
  locationColumn:     "Location",

  map_centroid:       new google.maps.LatLng(41.8781136, -87.66677856445312), //center that your map defaults to
  locationScope:      "chicago",      //geographical area appended to all address searches
  recordName:         "building",       //for showing number of results
  recordNamePlural:   "buildings",

  searchRadius:       1610,            //in meters ~ 1/2 mile
  defaultZoom:        11,             //zoom level when map is loaded (bigger is more zoomed in)
  addrMarkerImage:    'http://chicagobuildings.org/images/blue-pushpin.png',
  currentPinpoint:    null,
  violationsMode:     false,

  initialize: function() {
    geocoder = new google.maps.Geocoder();
    var myOptions = {
      zoom: MapsLib.defaultZoom,
      center: MapsLib.map_centroid,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map($("#map_canvas")[0],myOptions);

    MapsLib.searchrecords = null;

    //reset filters
    $("#txtSearchAddress").val(MapsLib.convertToPlainString($.address.parameter('address')));

    $("#ddlRadius").val("805");
    $("#rbCensus1").attr("checked", "checked");
    
    $("#cbOpen1").attr("checked", "checked");
    $("#cbOpen2").attr("checked", "checked");
    $("#cbOpen3").attr("checked", "checked");


    //ranges for our slider
    var minDate = moment("Jan 1 2010"); // Jan 1st 2010
    var maxDate = moment(); //now

    //starting values
    var startDate = moment().subtract('months', 3); //past 3 months
    var endDate = moment(); //now

    MapsLib.initializeDateSlider(minDate, maxDate, startDate, endDate, "days", 7);

    $( "#resultCount" ).html("");

    MapsLib.setDemographicsLabels("0&ndash;20%", "20&ndash;40%", "40&ndash;62%");

    MapsLib.poverty = new google.maps.FusionTablesLayer({
      query: {from:   MapsLib.povertyTableId, select: "geometry"}
    });
    MapsLib.unemployment = new google.maps.FusionTablesLayer({
      query: {from:   MapsLib.unemploymentTableId, select: "geometry"}
    });
    MapsLib.population = new google.maps.FusionTablesLayer({
      query: {from:   MapsLib.populationTableId, select: "geometry"}
    });
    MapsLib.medianIncome = new google.maps.FusionTablesLayer({
      query: {from:   MapsLib.medianIncomeId, select: "geometry"}
    });

    MapsLib.poverty.setMap(map);
    //run the default search
    MapsLib.doSearch();
  },

  initializeWatchmen: function() {

    geocoder = new google.maps.Geocoder();

    MapsLib.violationsMode = true;
    MapsLib.fusionTableId = MapsLib.violationsId;
    MapsLib.locationColumn = "latitude";
    MapsLib.recordName = "violation";       //for showing number of results
    MapsLib.recordNamePlural = "violations";

    var myOptions = {
      zoom: MapsLib.defaultZoom,
      center: MapsLib.map_centroid,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map($("#map_canvas")[0],myOptions);

    $( "#resultCount" ).html("");

    $("#ddlRadius").val("805");
    
    $("#cbViolation1").attr("checked", "checked");
    $("#cbViolation2").attr("checked", "checked");

    MapsLib.doSearch();
  },

  initializeDateSlider: function(minDate, maxDate, startDate, endDate, stepType, step) {
    var interval = MapsLib.sliderInterval(stepType);

    $('#minDate').html(minDate.format('MMM YYYY')); //Jan 2010
    $('#maxDate').html(maxDate.format('MMM YYYY')); //Mar 2013
    
    $('#startDate').html(startDate.format('L'));
    $('#endDate').html(endDate.format('L'));
    
    $('#date-range').slider({
      range: true,
      step: step,
      values: [ Math.floor((startDate.valueOf() - minDate.valueOf()) / interval), Math.floor((maxDate.valueOf() - minDate.valueOf()) / interval) ],
        max: Math.floor((maxDate.valueOf() - minDate.valueOf()) / interval),
        slide: function(event, ui) {
            $('#startDate').html(minDate.clone().add(stepType, ui.values[0]).format('L'));
            $('#endDate').html(minDate.clone().add(stepType, ui.values[1]).format('L'));
        },
        stop: function(event, ui) {
          MapsLib.doSearch();
        }
    });
  },

  sliderInterval: function(interval) {
    if (interval == "years")
      return 365 * 24 * 3600 * 1000;
    if (interval == "quarters")
      return 3 * 30.4 * 24 * 3600 * 1000;
    if (interval == "months") //this is very hacky. months have different day counts, so our point interval is the average - 30.4
      return 30.4 * 24 * 3600 * 1000;
    if (interval == "weeks")
      return 7 * 24 * 3600 * 1000;
    if (interval == "days")
      return 24 * 3600 * 1000;
    if (interval == "hours")
      return 3600 * 1000;
    else
      return 1;
  },

  doSearch: function() {
    MapsLib.clearSearch();
    var address = $("#txtSearchAddress").val();
    var whereClause = MapsLib.locationColumn + " not equal to ''";

    if (MapsLib.violationsMode) {
      var searchViolations = "'Violation Flag' IN (-1,";
      if ($("#cbViolation1").is(':checked')) searchViolations += "1,";
      if ($("#cbViolation2").is(':checked')) searchViolations += "2,";

      whereClause += " AND " + searchViolations.slice(0, searchViolations.length - 1) + ")";
    }
    else {

      var open1 = $("#cbOpen1").is(':checked');
      var open2 = $("#cbOpen2").is(':checked');
      var open3 = $("#cbOpen3").is(':checked');
      
      var inUse1 = $("#cbInUse1").is(':checked');
      var fire1 = $("#cbFire1").is(':checked');
      
      //is open
      var searchOpen = "'Open flag' IN (-1,";
      if (open1)
        searchOpen += "1,";
      if (open2)
        searchOpen += "0,";
      if (open3)
        searchOpen += "2,";

      whereClause += " AND " + searchOpen.slice(0, searchOpen.length - 1) + ")";
      
      //in use
      if (inUse1)
        whereClause += " AND 'In use flag' = 1";
      
      //fire
      if (fire1)
        whereClause += " AND 'Fire flag' = 1";
          
      whereClause += " AND 'DATE RECEIVED' >= '" + $('#startDate').html() + "'";
      whereClause += " AND 'DATE RECEIVED' <= '" + $('#endDate').html() + "'";
    }

    if (address != "") {
      if (address.toLowerCase().indexOf(MapsLib.locationScope) == -1)
        address = address + " " + MapsLib.locationScope;

      geocoder.geocode( { 'address': address}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
          MapsLib.currentPinpoint = results[0].geometry.location;

          $.address.parameter('address', encodeURIComponent(address));
          map.setCenter(MapsLib.currentPinpoint);
          map.setZoom(14);

          MapsLib.addrMarker = new google.maps.Marker({
            position: MapsLib.currentPinpoint,
            map: map,
            icon: MapsLib.addrMarkerImage,
            animation: google.maps.Animation.DROP,
            title:address
          });

          whereClause += " AND ST_INTERSECTS(" + MapsLib.locationColumn + ", CIRCLE(LATLNG" + MapsLib.currentPinpoint.toString() + "," + MapsLib.searchRadius + "))";

          MapsLib.drawSearchRadiusCircle(MapsLib.currentPinpoint);
          MapsLib.submitSearch(whereClause, map, MapsLib.currentPinpoint);
        }
        else {
          alert("We could not find your address: " + status);
        }
      });
    }
    else { //search without geocoding callback
      MapsLib.submitSearch(whereClause, map);
    }
  },

  submitSearch: function(whereClause, map) {
    //get using all filters
    if (MapsLib.violationsMode) {
      MapsLib.searchrecords = new google.maps.FusionTablesLayer({
        query: {
          from:   MapsLib.fusionTableId,
          select: MapsLib.locationColumn,
          where:  whereClause
        },
        styleId: 2,
        templateId: 2
      });
    }
    else {
      MapsLib.searchrecords = new google.maps.FusionTablesLayer({
        query: {
          from:   MapsLib.fusionTableId,
          select: MapsLib.locationColumn,
          where:  whereClause
        }
      });
    }
    MapsLib.searchrecords.setMap(map);
    MapsLib.displayCount(whereClause);
  },

  clearSearch: function() {
    if (MapsLib.searchrecords != null)
      MapsLib.searchrecords.setMap(null);
    if (MapsLib.addrMarker != null)
      MapsLib.addrMarker.setMap(null);
  },

  toggleCensus: function() {
    MapsLib.poverty.setMap(null);
    MapsLib.unemployment.setMap(null);
    MapsLib.population.setMap(null);
    MapsLib.medianIncome.setMap(null);
  
    if ($("#rbCensus1").is(':checked')) {
      MapsLib.poverty.setMap(map);
      MapsLib.setDemographicsLabels("0&ndash;20%", "20&ndash;40%", "40&ndash;62%");
    }
    if ($("#rbCensus2").is(':checked')) {
      MapsLib.unemployment.setMap(map);
      MapsLib.setDemographicsLabels("0&ndash;7%", "7&ndash;14%", "14&ndash;22%");
    }
    if ($("#rbCensus3").is(':checked')) {
      MapsLib.population.setMap(map);
      MapsLib.setDemographicsLabels("0&ndash;35k", "35k&ndash;75k", "75k&ndash;105k");
    }
    if ($("#rbCensus4").is(':checked')) {
      MapsLib.medianIncome.setMap(map);
      MapsLib.setDemographicsLabels("$10k&ndash;40k", "$40k&ndash;70k", "$70k&ndash;100k");
    }
    if ($("#rbCensus7").is(':checked')) {
      MapsLib.setDemographicsLabels("&ndash;", "&ndash;", "&ndash;");
    }

    MapsLib.refreshBuildings();
  },

  refreshBuildings: function() {
    if (MapsLib.searchrecords != null)
      MapsLib.searchrecords.setMap(map);
  },
  
  setDemographicsLabels: function(left, middle, right) {
    $('#legend-left').fadeOut('fast', function(){
      $("#legend-left").html(left);
    }).fadeIn('fast');
    $('#legend-middle').fadeOut('fast', function(){
      $("#legend-middle").html(middle);
    }).fadeIn('fast');
    $('#legend-right').fadeOut('fast', function(){
      $("#legend-right").html(right);
    }).fadeIn('fast');
  },

  findMe: function() {
    // Try W3C Geolocation (Preferred)
    var foundLocation;

    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        foundLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
        MapsLib.addrFromLatLng(foundLocation);
      }, null);
    }
    else {
      alert("Sorry, we could not find your location.");
    }
  },

  addrFromLatLng: function(latLngPoint) {
    geocoder.geocode({'latLng': latLngPoint}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[1]) {
          $('#txtSearchAddress').val(results[1].formatted_address);
          $('.hint').focus();
          MapsLib.doSearch();
        }
      } else {
        alert("Geocoder failed due to: " + status);
      }
    });
  },

  drawSearchRadiusCircle: function(point) {
      var circleOptions = {
        strokeColor: "#4b58a6",
        strokeOpacity: 0.3,
        strokeWeight: 1,
        fillColor: "#4b58a6",
        fillOpacity: 0.05,
        map: map,
        center: point,
        clickable: false,
        zIndex: -1,
        radius: parseInt(MapsLib.searchRadius)
      };
      MapsLib.searchRadiusCircle = new google.maps.Circle(circleOptions);
  },

  query: function(selectColumns, whereClause, callback) {
    var queryStr = [];
    queryStr.push("SELECT " + selectColumns);
    queryStr.push(" FROM " + MapsLib.fusionTableId);
    queryStr.push(" WHERE " + whereClause);

    var sql = encodeURIComponent(queryStr.join(" "));
    $.ajax({url: "https://www.googleapis.com/fusiontables/v1/query?sql="+sql+"&callback="+callback+"&key="+MapsLib.googleApiKey, dataType: "jsonp"});
  },

  handleError: function(json) {
    if (json["error"] != undefined) {
      var error = json["error"]["errors"]
      console.log("Error in Fusion Table call!");
      for (var row in error) {
        console.log(" Domain: " + error[row]["domain"]);
        console.log(" Reason: " + error[row]["reason"]);
        console.log(" Message: " + error[row]["message"]);
      }
    }
  },

  displayCount: function(whereClause) {
    var selectColumns = "Count()";
    MapsLib.query(selectColumns, whereClause,"MapsLib.displaySearchCount");
  },

  displaySearchCount: function(json) {
    MapsLib.handleError(json);
    var numRows = 0;
    if (json["rows"] != null)
      numRows = json["rows"][0];

    var name = MapsLib.recordNamePlural;
    if (numRows == 1)
    name = MapsLib.recordName;
    $( "#resultCount" ).fadeOut(function() {
        $( "#resultCount" ).html(MapsLib.addCommas(numRows) + " " + name + " found");
      });
    $( "#resultCount" ).fadeIn();
  },

  addCommas: function(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
  },

  toPercentage: function(nStr) {
   return (parseFloat(nStr) * 100).toFixed(1) + "%"
  },

  //converts a slug or query string in to readable text
  convertToPlainString: function(text) {
    if (text == undefined) return '';
    return decodeURIComponent(text);
  },

  uncacheTiles: function() {
    $("img[src*='googleapis']").each(function(){
      $(this).attr("src",$(this).attr("src")+"&"+(new Date()).getTime());
      //console.log($(this).attr("src"));
    });
  }
}