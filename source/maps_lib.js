/*------------------------------------------------------------------+
 | Functions used for searchable fusion table maps                  |
 | Requires jQuery                                                  |
 +-------------------------------------------------------------------*/

  var map;
  var geocoder;
  var addrMarker;
  var addrMarkerImage = 'http://chicagobuildings.org/images/blue-pushpin.png';
  
  var fusionTableId = 3631508; //main table for building data
  
  var povertyTableId = 1659611;
  var unemploymentTableId = 1659604;
  var populationTableId = 1659368;
  var medianIncomeId = 1659621;
  var percentBlackId = 1659729;
  var percentHispanicId = 1659569;
  
  var poverty = new google.maps.FusionTablesLayer(povertyTableId);
  var unemployment = new google.maps.FusionTablesLayer(unemploymentTableId);
  var population = new google.maps.FusionTablesLayer(populationTableId);
  var medianIncome = new google.maps.FusionTablesLayer(medianIncomeId);
  var percentBlack = new google.maps.FusionTablesLayer(percentBlackId);
  var percentHispanic = new google.maps.FusionTablesLayer(percentHispanicId);
  
  var searchRadius = 1610; //in meters ~ 1 mile
  var recordName = "building";
  var recordNamePlural = "buildings";
  var searchBuildings;
  var buildings = new google.maps.FusionTablesLayer(fusionTableId);
  
  var searchStr;
  var searchRadiusCircle;
  
  google.load('visualization', '1', {}); //used for custom SQL call to get count
  
  function initialize() {
  	initializeDateSlider();
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
	
	$("#rbCensus1").attr("checked", "checked");
	
	$("#cbOpen1").attr("checked", "checked");
	$("#cbOpen2").attr("checked", "checked");
	$("#cbOpen3").attr("checked", "checked");

	setDemographicsLabels("0&ndash;20%", "20&ndash;40%", "40&ndash;62%");
	
	searchBuildings = null;
	
	poverty.setMap(map);
	$("#txtSearchAddress").val("");
	doSearch();
  }
  
  function initializeDateSlider() {
	var minDate = new Date(2010, 1-1, 1);
    var maxDate = new Date();
    var initialStartDate = new Date();
    initialStartDate.setDate(maxDate.getDate() - 90);
    $('#minDate').html($.datepicker.formatDate('M yy', minDate));
    $('#maxDate').html($.datepicker.formatDate('M yy', maxDate));
    
    $('#startDate').html($.datepicker.formatDate('mm/dd/yy', initialStartDate));
    $('#endDate').html($.datepicker.formatDate('mm/dd/yy', maxDate));
    
    $('#date-range').slider({
    	range: true,
    	step: 30,
    	values: [ Math.floor((initialStartDate.getTime() - minDate.getTime()) / 86400000), Math.floor((maxDate.getTime() - minDate.getTime()) / 86400000) ],
        max: Math.floor((maxDate.getTime() - minDate.getTime()) / 86400000),
        slide: function(event, ui) {
            var date = new Date(minDate.getTime());
            date.setDate(date.getDate() + ui.values[0]);
            $('#startDate').html($.datepicker.formatDate('mm/dd/yy', date));
            date = new Date(minDate.getTime());
            date.setDate(date.getDate() + ui.values[1]);
            $('#endDate').html($.datepicker.formatDate('mm/dd/yy', date));
        },
        stop: function(event, ui) {
        	doSearch();
        }
    });
  }
	
	function doSearch() 
	{
		clearSearch();
		var address = $("#txtSearchAddress").val();
		
		searchRadius = $("#ddlRadius").val();
				
		var open1 = $("#cbOpen1").is(':checked');
		var open2 = $("#cbOpen2").is(':checked');
		var open3 = $("#cbOpen3").is(':checked');
		
		var inUse1 = $("#cbInUse1").is(':checked');
		var fire1 = $("#cbFire1").is(':checked');
		
		searchStr = "SELECT 'Location' FROM " + fusionTableId + " WHERE 'Location' not equal to ''";
				
		//is open
		var searchOpen = "'Open flag' IN (-1,";
        if (open1)
			searchOpen += "1,";
		if (open2)
			searchOpen += "0,";
		if (open3)
			searchOpen += "2,";

        searchStr += " AND " + searchOpen.slice(0, searchOpen.length - 1) + ")";
		
		//in use
        if (inUse1)
			searchStr += " AND 'In use flag' = 1";
		
		//fire
        if (fire1)
			searchStr += " AND 'Fire flag' = 1";
        
        searchStr += " AND 'DATE RECEIVED' >= '" + $('#startDate').html() + "'";
        searchStr += " AND 'DATE RECEIVED' <= '" + $('#endDate').html() + "'";
		
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
				
				searchStr += " AND ST_INTERSECTS('Location', CIRCLE(LATLNG" + results[0].geometry.location.toString() + "," + searchRadius + "))";
				
				//get using all filters
				//console.log(searchStr);
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
			//console.log(searchStr);
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
		poverty.setMap(null);
		unemployment.setMap(null);
		population.setMap(null);
		medianIncome.setMap(null);
		percentBlack.setMap(null);
		percentHispanic.setMap(null);
	
		if ($("#rbCensus1").is(':checked')) {
			poverty.setMap(map);
			setDemographicsLabels("0&ndash;20%", "20&ndash;40%", "40&ndash;62%");
		}
		if ($("#rbCensus2").is(':checked')) {
			unemployment.setMap(map);
			setDemographicsLabels("0&ndash;7%", "7&ndash;14%", "14&ndash;22%");
		}
		if ($("#rbCensus3").is(':checked')) {
			population.setMap(map);
			setDemographicsLabels("0&ndash;35k", "35k&ndash;75k", "75k&ndash;105k");
		}
		if ($("#rbCensus4").is(':checked')) {
			medianIncome.setMap(map);
			setDemographicsLabels("$10k&ndash;40k", "$40k&ndash;70k", "$70k&ndash;100k");
		}
		//if ($("#rbCensus5").is(':checked')) {
		//	percentBlack.setMap(map);
		//	setDemographicsLabels("0&ndash;30%", "30&ndash;60%", "60&ndash;100%");
		//}
		//if ($("#rbCensus6").is(':checked')) {
		//	percentHispanic.setMap(map);
		//	setDemographicsLabels("0&ndash;30%", "30&ndash;60%", "60&ndash;90%");
		//}
		if ($("#rbCensus7").is(':checked')) {
			setDemographicsLabels("&ndash;", "&ndash;", "&ndash;");
		}
			
		refreshBuildings();
	}
	
	function setDemographicsLabels(left, middle, right) 
	{
		$('#legend-left').fadeOut('fast', function(){
			$("#legend-left").html(left);
		}).fadeIn('fast');
		$('#legend-middle').fadeOut('fast', function(){
			$("#legend-middle").html(middle);
		}).fadeIn('fast');
		$('#legend-right').fadeOut('fast', function(){
			$("#legend-right").html(right);
		}).fadeIn('fast');
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
	      clickable: false,
	      zIndex: -1,
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
	  searchStr = searchStr.replace("SELECT 'Location' ","SELECT Count() ");
	  
	  //set the callback function
	  getFTQuery(searchStr).send(displaySearchCount);
	}

	function displaySearchCount(response) {
	  var numRows = 0;
	  if (response.getDataTable().getNumberOfRows() > 0)
	  	numRows = parseInt(response.getDataTable().getValue(0, 0));
	  var name = recordNamePlural;
	  if (numRows == 1)
		name = recordName;
	  $( "#resultCount" ).fadeOut(function() {
        $( "#resultCount" ).html(addCommas(numRows) + " " + name + " found");
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
	
setTimeout(function() {
  //console.log("refetching map tiles");
  $("img[src*='googleapis']").each(function(){
    $(this).attr("src",$(this).attr("src")+"&"+(new Date()).getTime());
  });
},3000);