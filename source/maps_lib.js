/*------------------------------------------------------------------+
 | Functions used for searchable fusion table maps                  |
 | Requires jQuery                                                  |
 +-------------------------------------------------------------------*/

  var map;
  var geocoder;
  var addrMarker;
  var addrMarkerImage = 'http://chicagobuildings.org/images/icons/blue-pushpin.png';
  
  var fusionTableId = 1614852;
  var censusTableId = 1647341;
  var searchRadius = 1610; //in meters ~ 1 mile
  var recordName = "building";
  var recordNamePlural = "buildings";
  var searchBuildings;
  var buildings = new google.maps.FusionTablesLayer(fusionTableId);
  var census = new google.maps.FusionTablesLayer(censusTableId);
  var searchStr;
  var searchRadiusCircle;
  
  google.load('visualization', '1', {}); //used for custom SQL call to get count
  
  function initialize() {
	$( "#resultCount" ).html("");
  
  	geocoder = new google.maps.Geocoder();
    var chicago = new google.maps.LatLng(41.850033, -87.6500523);
    var myOptions = {
      zoom: 11,
      center: chicago,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById("map_canvas"),myOptions);
	
	$("#ddlRadius").val("805");
	
	$("#cbCensus").attr("checked", "checked");
    
    $("#cbVacant1").attr("checked", "checked");
	$("#cbVacant2").attr("checked", "checked");
	$("#cbVacant3").attr("checked", "checked");
	
	$("#cbInUse1").attr("checked", "checked");
	$("#cbInUse2").attr("checked", "checked");
	
	$("#cbOpen1").attr("checked", "checked");
	$("#cbOpen2").attr("checked", "checked");
	$("#cbOpen3").attr("checked", "checked");
	
	$("#cbFire1").attr("checked", "checked");
	$("#cbFire2").attr("checked", "checked");

	searchBuildings = null;
	
	census.setMap(map);
	buildings.setMap(map);
	$("#txtSearchAddress").val("");
  }
	
	function doSearch() 
	{
		clearSearch();
		var address = $("#txtSearchAddress").val();
		
		searchRadius = $("#ddlRadius").val();
		
		var vacant1 = $("#cbVacant1").is(':checked');
		var vacant2 = $("#cbVacant2").is(':checked');
		var vacant3 = $("#cbVacant3").is(':checked');
		
		var inUse1 = $("#cbInUse1").is(':checked');
		var inUse2 = $("#cbInUse2").is(':checked');
		
		var open1 = $("#cbOpen1").is(':checked');
		var open2 = $("#cbOpen2").is(':checked');
		var open3 = $("#cbOpen3").is(':checked');
		
		var fire1 = $("#cbFire1").is(':checked');
		var fire2 = $("#cbFire2").is(':checked');
		
		searchStr = "SELECT LONGITUDE FROM " + fusionTableId + " WHERE LONGITUDE not equal to ''";
		
		//vacant
		var searchVacant = "'Vacant flag' IN (-1,";
        if (vacant1)
			searchVacant += "1,";
		if (vacant2)
			searchVacant += "0,";
		if (vacant3)
			searchVacant += "2,";

        searchStr += " AND " + searchVacant.slice(0, searchVacant.length - 1) + ")";
		
		//in use
		var searchUse = "'In use flag' IN (-1,";
        if (inUse1)
			searchUse += "1,";
		if (inUse2)
			searchUse += "0,";

        searchStr += " AND " + searchUse.slice(0, searchUse.length - 1) + ")";
		
		//is open
		var searchOpen = "'Open flag' IN (-1,";
        if (open1)
			searchOpen += "1,";
		if (open2)
			searchOpen += "0,";
		if (open3)
			searchOpen += "2,";

        searchStr += " AND " + searchOpen.slice(0, searchOpen.length - 1) + ")";
		
		//fire
		var searchFire = "'Fire flag' IN (-1,";
        if (fire1)
			searchFire += "1,";
		if (fire2)
			searchFire += "0,";

        searchStr += " AND " + searchFire.slice(0, searchFire.length - 1) + ")";
		
		// because the geocode function does a callback, we have to handle it in both cases - when they search for and address and when they dont
		if (address != "")
		{
			if (address.toLowerCase().indexOf("chicago") == -1)
				address = address + " chicago";
			_trackClickEventWithGA("Search", "Chicago Vacant and Abandoned Buildings", address);	
			geocoder.geocode( { 'address': address}, function(results, status) 
			{
			  if (status == google.maps.GeocoderStatus.OK) 
			  {
				//alert("found address: " + results[0].geometry.location.toString());
				map.setCenter(results[0].geometry.location);
				map.setZoom(14);
				
				addrMarker = new google.maps.Marker({
				  position: results[0].geometry.location, 
				  map: map, 
				  icon: addrMarkerImage,
				  animation: google.maps.Animation.DROP,
				  title:address
				});
				drawSearchRadiusCircle(results[0].geometry.location);
				
				searchStr += " AND ST_INTERSECTS(LONGITUDE, CIRCLE(LATLNG" + results[0].geometry.location.toString() + "," + searchRadius + "))";
				
				//get using all filters
				searchBuildings = new google.maps.FusionTablesLayer(fusionTableId, {
					query: searchStr}
					);
			
				searchBuildings.setMap(map);
				displayCount(searchStr);
			  } 
			  else 
			  {
				alert("We could not find your address: " + status);
			  }
			});
		}
		else
		{
			//get using all filters
			searchBuildings = new google.maps.FusionTablesLayer(fusionTableId, {
				query: searchStr}
				);
		
			searchBuildings.setMap(map);
			displayCount(searchStr);
		}
  	}
	
	function clearSearch() {
		if (searchBuildings != null)
			searchBuildings.setMap(null);
		if (addrMarker != null)
			addrMarker.setMap(null);	
		if (searchRadiusCircle != null)
			searchRadiusCircle.setMap(null);
		
		buildings.setMap(null);
	}
	
	function refreshBuildings() {
		if (searchBuildings != null)
			searchBuildings.setMap(map);
		else
			buildings.setMap(map);
	}
	
	function toggleCensus() {
		if ($("#cbCensus").is(':checked'))
			census.setMap(map);
		else
			census.setMap(null);
			
		refreshBuildings();
	}

 function findMe() {
	  // Try W3C Geolocation (Preferred)
	  var foundLocation;
	  
	  if(navigator.geolocation) {
	    navigator.geolocation.getCurrentPosition(function(position) {
	      foundLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
	      addrFromLatLng(foundLocation);
	    }, null);
	  }
	  else {
	  	alert("Sorry, we could not find your location.");
	  }
	}
	
	function addrFromLatLng(latLngPoint) {
	    geocoder.geocode({'latLng': latLngPoint}, function(results, status) {
	      if (status == google.maps.GeocoderStatus.OK) {
	        if (results[1]) {
	          $('#txtSearchAddress').val(results[1].formatted_address);
	          $('.hint').focus();
	          doSearch();
	        }
	      } else {
	        alert("Geocoder failed due to: " + status);
	      }
	    });
	  }
	
	function drawSearchRadiusCircle(point) {
	    var circleOptions = {
	      strokeColor: "#4b58a6",
	      strokeOpacity: 0.3,
	      strokeWeight: 1,
	      fillColor: "#4b58a6",
	      fillOpacity: 0.05,
	      map: map,
	      center: point,
	      radius: parseInt(searchRadius)
	    };
	    searchRadiusCircle = new google.maps.Circle(circleOptions);
	}
	
	function getFTQuery(sql) {
		var queryText = encodeURIComponent(sql);
		return new google.visualization.Query('http://www.google.com/fusiontables/gvizdata?tq='  + queryText);
	}
	
	function displayCount(searchStr) {
	  //set the query using the parameter
	  searchStr = searchStr.replace('SELECT LONGITUDE ','SELECT Count() ');
	  
	  //set the callback function
	  getFTQuery(searchStr).send(displaySearchCount);
	}
	
	function getTotalRecordCount() {
		getFTQuery("SELECT Count() FROM " + fusionTableId).send(displayTotalRecordCount);
	}
	
	function displayTotalRecordCount(response) {
	  var count = 0;
	  if (response.getDataTable().getNumberOfRows() > 0)
	  	count = parseInt(response.getDataTable().getValue(0, 0));
	  
	  $('#totalBuildings').html(addCommas(count));	
	}

	function displaySearchCount(response) {
	  var numRows = 0;
	  if (response.getDataTable().getNumberOfRows() > 0)
	  	numRows = parseInt(response.getDataTable().getValue(0, 0));
	  var name = recordNamePlural;
	  if (numRows == 1)
		name = recordName;
	  $( "#resultCount" ).fadeOut(function() {
        $( "#resultCount" ).html("found " + numRows + " " + name);
      });
	  $( "#resultCount" ).fadeIn();
	}
	
	function addCommas(nStr)
	{
		nStr += '';
		x = nStr.split('.');
		x1 = x[0];
		x2 = x.length > 1 ? '.' + x[1] : '';
		var rgx = /(\d+)(\d{3})/;
		while (rgx.test(x1)) {
			x1 = x1.replace(rgx, '$1' + ',' + '$2');
		}
		return x1 + x2;
	}