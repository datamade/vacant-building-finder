/*------------------------------------------------------------------+
 | Functions used for searchable fusion table maps                  |
 | Requires jQuery                                                  |
 +-------------------------------------------------------------------*/

  var map;
  var geocoder;
  var addrMarker;
  var addrMarkerImage = 'http://derekeder.com/images/icons/blue-pushpin.png';
  
  var fusionTableId = 580362;
  var searchRadius = 1610; //in meters ~ 1 mile
  var recordName = "building";
  var recordNamePlural = "buildings";
  var searchBuildings;
  var buildings = new google.maps.FusionTablesLayer(fusionTableId);
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
    
    $("#cbOccupied").attr("checked", "checked");
	$("#cbVacant").attr("checked", "checked");
	$("#cbUnknown").attr("checked", "checked");
	
	$("#cbFire1").attr("checked", "checked");
	$("#cbFire2").attr("checked", "checked");
	$("#cbFire3").attr("checked", "checked");
	
	searchBuildings = null;
	
	buildings.setMap(map);
	$("#txtSearchAddress").val("");
  }
	
	function doSearch() 
	{
		clearSearch();
		var address = $("#txtSearchAddress").val();
		
		searchRadius = $("#ddlRadius").val();
		
		var occupied = $("#cbOccupied").is(':checked');
		var vacant = $("#cbVacant").is(':checked');
		var unknown = $("#cbUnknown").is(':checked');
		
		var fire1 = $("#cbFire1").is(':checked');
		var fire2 = $("#cbFire2").is(':checked');
		var fire3 = $("#cbFire3").is(':checked');
		
		searchStr = "SELECT Address FROM " + fusionTableId + " WHERE Address not equal to ''";
		
		var searchType = "'ANY PEOPLE USING PROPERTY? (HOMELESS, CHILDEN, GANGS)' IN (-1,";
        if (occupied)
			searchType += "1,";
		if (vacant)
			searchType += "0,";
		if (unknown)
			searchType += "2,";

        searchStr += " AND " + searchType.slice(0, searchType.length - 1) + ")";
					
		var searchFire = "'IS THE BUILDING VACANT DUE TO FIRE?' IN (-1,";
        if (fire1)
			searchFire += "1,";
		if (fire2)
			searchFire += "0,";
		if (fire3)
			searchFire += "2,";

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
				
				searchStr += " AND ST_INTERSECTS(Address, CIRCLE(LATLNG" + results[0].geometry.location.toString() + "," + searchRadius + "))";
				
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
	  searchStr = searchStr.replace('SELECT Address ','SELECT Count() ');
	  
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
	  
	  $('#totalBuildings').html(count);	
	}

	//define callback function, this is called when the results are returned
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