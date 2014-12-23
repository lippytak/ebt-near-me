//simple object for rotating through 0 to n
function Rotator (n,state){
  state = state || 0
  return function () {
    return state < n ? state+=1 : state = 0
  }
}

ebt = {
  timeoutID:null,
  user:{
    marker: null
  },
  place:{
    marker: null,
    image : {
      url: null,
      size: new google.maps.Size(71, 71),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(17, 34),
      scaledSize: new google.maps.Size(25, 25)
    }
  },
  infoWindow : new google.maps.InfoWindow(),
  directions_pre_link:"",
  options : {
    state:'CA',
    LatLng: new google.maps.LatLng(37.7833, -122.4167), // San Francisco
    no_geolocation_zoom : 10,
    default_zoom : 18,
    visible_atm_data:null,
    feedback_url: 'https://codeforamerica.wufoo.com/forms/ebtnearme-feedback/def/field3=' 
  }
}

ebt.markers = {
    types: [
    {
      style:  {
        where: "type IN ('ATM', 'POS') AND surcharge = '0'",
        iconName: 'grn_circle'
      },
      legend: {
        title:'Free ATMs',
        color: 'green'
      }
    },
    {
      style:  {
        where: "type IN ('ATM', 'POS') AND surcharge NOT EQUAL TO '0'", 
        iconName: 'ylw_circle'
      },
      legend: {
        title:'Paid ATMs',
        color: 'yellow'
      }
    },
    {
      style:  {
        where: "type = 'store'",
        iconName: 'blu_circle'
      },
      legend: {
        title:'CalFresh Stores',
        color: 'blue'
      }
    }
  ],
  getArray : function (item,i) {
    q = []
    i = i || 0
    for (i; i < ebt.markers.types.length; i++) {
      q.push(ebt.markers.types[i][item])
    }
    return q
  },
  styles : function (i) {
    return ebt.markers.getArray('style',i)
      .map(function (val) {
        return {where: val.where, markerOptions: {iconName: val.iconName}}
      })
  },
  legend : function (i) {
    return ebt.markers.getArray('legend',i)
      .map(function (val) {
        return '<div class="legend-item"><div class="color '+val.color+'"></div><p>'+val.title+'</p></div>'
      })
      .join('')
  }
}

ebt.fusion ={
  table : '1gTMiiUxNgLDISIymtea1gJ9oph_F4Lt7BE-FLfAe',
  apiKey : 'AIzaSyDzaRUwEz7l0m3sEbROdDNCNRmsJ-zvUUc'
}

ebt.fusion.data_layer = new google.maps.FusionTablesLayer({
  suppressInfoWindows:true,
  query: {
    select: 'geo_address',
    from: ebt.fusion.table,
    where: "state = '"+ebt.options.state+"'"},
  styles: ebt.markers.styles()
})

ebt.googlemapOptions = {
  zoom: ebt.options.no_geolocation_zoom,
  disableDefaultUI: true,
  center: ebt.options.LatLng,
  styles: [
    {
      featureType: "poi",
      elementType: "all",
      stylers: [
        { visibility: "off" }
      ]
    }
  ]
};

ebt.utils = {
  templates:{
    printed :{
      name: function () {
        var row = this
        switch (row.type){
          case 'store':
            return row.store_name;
            break;
          case 'ATM':
            if (row.location_name){
              return '<b>ATM</b> at ' + row.location_name;
            } 
            else {
              return 'This is a ' + row.atm_name + '<b>ATM</b>';
            }
            break;
          case 'POS':
            if (row.location_name){
              return 'Cash back at ' + row.location_name;
            }
            break;
          default:
            return ''
        }
      },
      address: function () {
        return ebt.utils.toTitleCase(this.text_address)
      }
    },
    infowindow: {
      name: function () {
        var row = this
        switch (row.type){
          case 'store':
            return row.store_name
            break;
          case 'ATM':
            if (row.location_name){
              return 'This is an <b>ATM</b> at ' + row.location_name;
            } 
            else {
              return 'This is a ' + atm_name + ' <b>ATM</b>';
            }
            break;
          case 'POS':
            return 'This is a cash back location at ' + location_name;
            break;
          default:
            return ''
        }      
      },
      directions: function () {
        return ebt.directions_pre_link + encodeURIComponent(text_address) + "' target='_blank'>" + this.text_address + "</a>";
      },
      feedback :  function () {
        // See CfA Wufoo API docs for details
        wufoo_url = ebt.options.feedback_url + this.type + '&field2=' + this.text_address;
        return '<a href="' + wufoo_url + '">Report a problem with this location</a>'
      }
    },
    cost_phrase: function () {
      if (this.type === 'store'){
        return false
      }
      switch (this.surcharge){
        case '0':
          return "It's <b>free</b> to use and you can get up to <b>$" + this.cash_limit + "</b>";
          break;
        case 'NaN':
          return 'You can take out <b>$' + this.cash_limit + '</b> but you have to pay a <b>2% fee</b>.';
          break;
        default:
          return 'It costs <b>$' + this.surcharge + '</b> to use and you can get up to <b>$' + this.cash_limit + '</b>';  
      }
    }
  },
  appendPrintRows: function (data) {
    $( "#printable-list-div" ).empty();
    $('#printable-list-div').append(ebt.utils.renderPrintRows(data))  
  },
  renderPrintRows: function (data) {
    if (data.rows) {
      var rows = data.rows.map(function (row) {
        view ={}
        $.each(row, function( index, value ) {
          view[data.columns[index]] = value
        });
        view.name = ebt.utils.templates.printed.name
        view.cost = ebt.utils.templates.cost_phrase
        view.address = ebt.utils.templates.printed.address
        return view
      })
      return Mustache.render($('#print-template').html(),{rows:rows})
    }
  },
  renderInfowindow: function (row) {
    view = {};
    $.each( row, function( key, value ) {
      view[key] = value.value
    });

    view.name = ebt.utils.templates.infowindow.name
    view.directions = ebt.utils.templates.infowindow.directions
    view.feedback = ebt.utils.templates.infowindow.feedback
    view.cost = ebt.utils.templates.cost_phrase

    return Mustache.render($('#infowindow-template').html(),view)
    
  },
  toTitleCase : function (str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
  },
  queryAndAppendVisibleATMData : function () {
    var bounds = ebt.map.getBounds()
    var sw = bounds.getSouthWest()
    var ne = bounds.getNorthEast()
    var r = (google.maps.geometry.spherical.computeDistanceBetween(sw, ne))/2
    var center = ebt.map.getCenter()
    var query = ['SELECT * FROM',
                 ebt.fusion.table,
                 'WHERE ST_INTERSECTS(geo_address, CIRCLE(LATLNG',
                 center,',',r,')) LIMIT 12']
                .join(' ')

    // Send the JSONP request using jQuery
    $.ajax({
      data:{
        sql: query,
        key: ebt.fusion.apiKey
      },
      url: 'https://www.googleapis.com/fusiontables/v1/query',
      dataType: 'jsonp',
      success: ebt.utils.appendPrintRows
    })
  },
  addLayersAndIdleListener : function () {
    // Start idle listener after we settle on initial location
    ebt.fusion.data_layer.setMap(ebt.map);
    google.maps.event.addListener(ebt.map, 'idle', ebt.handle.Idle);
  },
  setElementAttributes : function(el, attrs) {
    for(var key in attrs) {
      el.setAttribute(key, attrs[key]);
    }
  }
}

ebt.handle ={
  foundLocation : function (position) {
    var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);

    ebt.map.setZoom(ebt.options.default_zoom);
    ebt.map.setCenter(pos);
    ebt.utils.addLayersAndIdleListener();

    // Geomarker
    var GeoMarker = new GeolocationMarker();
      GeoMarker.setCircleOptions({
        visible: false});

      google.maps.event.addListenerOnce(GeoMarker, 'position_changed', function() {
        ebt.map.setCenter(this.getPosition());
      });

    GeoMarker.setMap(ebt.map);
  },
  noLocation : function () {
    infowindow = new google.maps.InfoWindow({
      map: ebt.map,
      position: ebt.map.getCenter(),
      content: "Hmmm, I couldn't detect your location.<br>Try searching for an address instead."
    });
    infowindow.setMap(ebt.map);
    ebt.utils.addLayersAndIdleListener();
  },
  Idle: function () {
    window.clearTimeout(ebt.timeoutID);
    ebt.timeoutID = window.setTimeout(ebt.utils.queryAndAppendVisibleATMData, 2000);
  },
  toggleSearch : function() {
    var input = document.getElementById('address-input');
    var toggle = document.getElementById('toggle-icon');
    if (input.style.display == 'none') {
        input.style.display = 'block';
        input.focus();
        toggle.setAttribute("src", "public/img/close.png")
    }
    else {
        input.style.display = 'none';
        toggle.setAttribute("src", "public/img/search.png")
    }
  }
};

$(document).ready(function () {

  if (/iPhone/i.test(navigator.userAgent)) {
    ebt.directions_pre_link = "<a href='http://maps.google.com/?saddr=Current%20Location&daddr="
  } else if (/Android/i.test(navigator.userAgent)) {
    ebt.directions_pre_link = "<a href='geo:"
  } else {
    ebt.directions_pre_link = "<a href='http://maps.google.com?q="
    // Add zoom button for laptops/desktops
    ebt.googlemapOptions.zoomControl = true
    ebt.googlemapOptions.zoomControlOptions = {
      style: google.maps.ZoomControlStyle.LARGE,
      position: google.maps.ControlPosition.LEFT_CENTER
    }
  }

  ebt.map = new google.maps.Map(document.getElementById('map-canvas'), ebt.googlemapOptions);

  ebt.place.marker = new google.maps.Marker();
    

  // add header
  ebt.map.controls[google.maps.ControlPosition.TOP_LEFT ].push(document.getElementById('header'));
  ebt.searchBox = new google.maps.places.SearchBox(document.getElementById("address-input"));

  // Legend
  var legend = (document.createElement('div'));
  legend.setAttribute("id", "legend");
  legend.innerHTML = ebt.markers.legend();
  legend.index = 1;
  ebt.map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(legend);


  // start adding events

  $('#toggle-target').on("click",function (e) {
    ebt.handle.toggleSearch()
  })

  google.maps.event.addListener(ebt.searchBox, 'places_changed', function() {
    place = ebt.searchBox.getPlaces()[0];

    // Get the icon, place name, and location.
    ebt.place.image = place.icon

    // Remove current marker if it exists and add the new one
    if (ebt.place.marker) {ebt.place.marker.setMap(null)};
    ebt.place.marker.setOptions({
      map: ebt.map,
      icon: ebt.place.image,
      title: place.name,
      position: place.geometry.location
    });

    // Center and zoom map to place
    ebt.map.setCenter(place.geometry.location)
    ebt.map.setZoom(ebt.options.default_zoom);

  });

  // Bias the SearchBox results towards places that are within the bounds of the
  // current map's viewport.

  google.maps.event.addListener(ebt.map, 'bounds_changed', function() {
    ebt.searchBox.setBounds(ebt.map.getBounds());
  });


  google.maps.event.addListener(ebt.fusion.data_layer, 'click', function(e) {

    phrases = ebt.utils.getPhrasesFromRow(e.row);

    // Log click events in Google analytics
    if (type=='ATM'||type=='POS') {
      ga('send', 'event', 'ATM', 'click', 1);
    } else if (type=='store') {
      ga('send', 'event', 'Store', 'click', 1);
    }

    ebt.infoWindow.setOptions({
      content: ebt.utils.renderInfowindow(e.row),
      position: e.latLng,
      pixelOffset: e.pixelOffset
    });
    ebt.infoWindow.open(ebt.map);

  });
  
  // Try HTML5 geolocation
  $(function () {
    if (Modernizr.geolocation) {
      navigator.geolocation.getCurrentPosition(ebt.handle.foundLocation, ebt.handle.noLocation, {timeout:7000});
    } else {
      ebt.handle.noLocation();
    }
  });
});
