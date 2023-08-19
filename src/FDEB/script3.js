
const urls = {
  airports_c: "grid_locs.csv",
  airports_f: "grid_locs.csv",
  flights:    "flights.csv", 
  walks:      "walks.csv"
};

const svg                 = d3.select("svg");
const width               = parseInt(svg.attr("width"));
const height              = parseInt(svg.attr("height"));
const hypotenuse          = Math.sqrt(width * width + height * height);

// used to scale airport bubbles
const node_size_min       = 1;          // 4
const node_size_max       = 2.5;        // 18

// used to scale number of segments per line
const min_segments_domain = 0;
const max_segments_domain = hypotenuse; 
const min_segments_range  = 3;          // 20
const max_segments_range  = 10;         // 30

// settle at a layout faster
const alpha_decay         = 0.5;

// nearby nodes attract each other
const force_charge_many   = 10;         // 10
const force_distance_max  = 0;         // scales.airports.range()[1] * 2
// edges want to be as short as possible
// prevents too much stretching
const force_link_strength = 1;         // 0.7, 0.001
const force_link_distance = 1;         // 100

const max_time = 12; // 13;

const scales = {
  // used to scale airport bubbles
  // airports: d3.scaleSqrt()
  airports: d3.scalePow().exponent(0.9)
    .range([node_size_min, node_size_max]),
  // used to scale number of segments per line
  segments: d3.scaleLinear()
    .domain([min_segments_domain, max_segments_domain])
    .range( [min_segments_range,  max_segments_range]) 
  
};

const stroke_width   = function(d, i){ return 5;    };  //flights[i].count**(-0.5/10**10) ;
const stroke_opacity = function(d, i){ return 0.3; };
const node_radius    = function(d, i){ return scales.airports(d.outgoing/500);}

// have these already created for easier drawing
const g = {
  flights    : svg.select("g#flights"),
  airports_c : svg.select("g#airports_c"),
  airports_f : svg.select("g#airports_f"),
  airportText: svg.select("g#airportText"),
  months:      svg.select("g#months")
};

// load the airport and flight data together
const promises = [
  d3.csv(urls.airports_f, typeAirportFixed),
  d3.csv(urls.airports_c, typeAirportControl),
  d3.csv(urls.flights,    typeFlight),
  d3.csv(urls.walks,      typeWalk),
];

Promise.all(promises).then(processData);

function typeAirportFixed(airport) {
  airport.y = parseFloat(airport.longitude);
  airport.x = parseFloat(airport.latitude);
  airport.outgoing = 0; 
  airport.incoming = 0; 
  airport.flights = [];
  return airport;
}

function typeAirportControl(airport) {
  airport.y = parseFloat(airport.longitude);
  airport.x = parseFloat(airport.latitude);
  airport.outgoing = 0;  
  airport.incoming = 0;  
  airport.flights = [];  
  return airport;
}

function typeFlight(flight) {
  flight.count = parseInt(flight.count);
  return flight;
}

function typeWalk(walk){
    walk.length = 0
    let start = false;
    for(var i = 0; i < max_time; i++){
        if(walk[i] != ""){
          if (start == false){
            start = true;
            walk.start = i;
          }
          walk.length += 1;
        }
    }
    // walk.length = length;
    return walk;
}

// process airport and flight data
function processData(values) {

  let airports_c = values[0];
  let airports_f = values[1];
  let flights    = values[2];
  let walks      = values[3];

  // convert airports array (pre filter) into map for fast lookup
  let iata_c = new Map(airports_c.map(node => [node.iata, node]));
  let iata_f = new Map(airports_f.map(node => [node.iata, node]));

  // calculate incoming and outgoing degree based on flights
  // flights are given by airport iata code (not index)
  flights.forEach(function(link) {
    
    link.source = iata_c.get(link.origin);
    link.target = iata_c.get(link.destination);

    link.source.outgoing += link.count;
    link.target.incoming += link.count;
  });

  drawAirports(airports_c);
  drawWalks(airports_f, airports_c, flights, walks, iata_f, iata_c);
  drawMonths();
  drawNames(airports_c);
}   

function drawMonths(){
    var svg = d3.select('#months')
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("transform", "translate(100,100)");

    var x = d3.scalePoint()
      .domain(["JAN", "FEB", "MAR", "APRL", "MAY", 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT','NOV', 'DEC'])         // This is what is written on the Axis: from 0 to 100
      .range([85, 1200]);    
    
    svg
      .append("g")
      .style('font', '20px sans-serif')
      //.style('font', 'bold')
      .attr("transform", "translate(58,620)")
      // .attr("y", 1000)
      .style("stroke-width", 1)
      .call(d3.axisBottom(x));
}

function drawNames(airports){
  g.airportText.selectAll("text")
    .data(airports, d => d.iata)
    .enter()
    .append('text')
    .attr('class','airportName')
    .attr("x", d => d.x - 80) // calculated on load
    .attr("y", d => d.y)
    .text(d => d.iata)

  let airList = document.getElementsByClassName("airportName")

  for(let i = 0; i < airList.length; i ++){
    if((airList[i].innerHTML)[4]==1 && (airList[i].innerHTML)[5] == null){
      airList[i].innerHTML.slice(0,3)
    }
    else{
      airList[i].style.display = 'none'
    }
  }
  g.airportText.selectAll("text")
    .text(d => d.iata.slice(0,3))
}

function drawAirports(airports) {

  // draw airport bubbles
  g.airports_f.selectAll("circle.airport")
    .data(airports, d => d.iata)
    .enter()
    .append("circle")
    .attr("r", node_radius)
    .attr("cx", d => d.x) // calculated on load
    .attr("cy", d => d.y) // calculated on load
    .attr("class", "airport")
    .style("fill", function(d) { return d.color; })
    .each(function(d) {
      // adds the circle object to our airport
      // makes it fast to select airports on hover
      d.bubble = this;
    })
    .on("mouseover", function(d) {
      d.flights.forEach(x => { x.style['stroke-opacity'] = 1; });
    })
    .on("mouseout", function(d) {
      d.flights.forEach(x => {  x.style['stroke-opacity'] = stroke_opacity(x); });
    })
}

function drawWalks(airports_f, airports_c, flights, walks, iata_f, iata_c) {

    let bundle = {nodes_c: [], links: [], paths: [], nodes_f: []};
    
    bundle.nodes_c = airports_c.map(function(d, i) {
        d.x = d.x;
        d.y = d.y;  
        return d;
    });

    bundle.nodes_f = airports_f.map(function(d, i) {
      d.fx = d.x;
      d.fy = d.y;
      return d;
    });

    bundle.links = flights.map(function(d, i) {
        return {
          'source': d.source, 
          'target': d.target 
        };
    });

    bundle.paths = walks.map(function(d, i) {
        new_walk = [];
        // console.log(d);
        new_walk.push(iata_f.get(d[0]));
        for(let i = 1; i < d.length-1; i++) {
            new_walk.push(iata_c.get(d[i]));
        }
        new_walk.push(iata_f.get(d[d.length-1]));
        return new_walk;
    });

    console.log(bundle);

    var defs = svg.append("defs");


    // https://github.com/d3/d3-shape#curveBundle
    let line = d3.line()
        .curve(d3.curveBundle)
        .x(airport => airport.x)
        .y(airport => airport.y);

    let links = g.flights.selectAll("path.flight")
        .data(bundle.paths)
        .enter()
        .append("path")
        .attr("d", line)
        .attr("class", "flight")
        .style("stroke", function(d,i) {

          var gradient = defs.append("linearGradient")
            .attr("id", "svgGradient")
            .attr("x1", "0%").attr("x2", "100%")
            .attr("y1", "0%").attr("y2", "100%");
      
          gradient.append("stop")
            .attr("class", "start")
            .attr("offset", "0%")
            .attr("stop-color", d[0].color)
            .attr("stop-opacity", 1);
      
          gradient.append("stop")
          .attr("class", "end")
          .attr("offset", "100%")
          .attr("stop-color", d[d.length-1].color)
          .attr("stop-opacity", 1);
           
          // return "url(#svgGradient)"
          // var myColor = d3.scaleSequential().domain([1,1000]).interpolator(d3.interpolateViridis);
            // if (d[0].cluster == d[d.length-1].cluster) {
            //     return myColor[d[0].color]; 
            // } else { 
            //     return "orange"; 
            // }
            // console.log(i);
            return d[0].color;
        })
        .style("stroke-width", stroke_width)
        .style("stroke-opacity", stroke_opacity)
        .each(function(d, i) {
            // adds the path object to our source airport
            // makes it fast to select outgoing paths
            // d[0].flights.push(this);
            // console.log(d[i]);
            d[0].flights.push(this);
        })
        .on("mouseover", function(d) { this.style['stroke-opacity'] = 1;   })
        .on("mouseout", function(d)  { this.style['stroke-opacity'] = stroke_opacity(d); });

    // https://github.com/d3/d3-force
    let layout = d3.forceSimulation()
        // settle at a layout faster
        .alphaDecay(alpha_decay)
        // nearby nodes attract each other
        // .force("charge", d3.forceManyBody()
        //     .strength(force_charge_many)
        //     .distanceMax(force_distance_max)
        // )
        // edges want to be as short as possible
        // prevents too much stretching
        .force("link", d3.forceLink()
            .strength(force_link_strength)
            .distance(force_link_distance)
        )
        .force("x", d3.forceX().strength(function(d, i){
          console.log((d.y));
          return 0;
        }))
        // .force("y", d3.forceY(0).strength(0.5))
        // .force("center", 0)
        .on("tick", function(d) { links.attr("d", line); })
        .on("end", function(d)  { console.log("layout complete"); });

    layout.nodes(bundle.nodes_c).force("link").links(bundle.links);

    // bundle.paths.forEach(function(d, i) {
    //   let last = d[d.length-1];
    //   console.log("last");
    //   last.fx = last.x;
    //   last.fy = last.y;
    // });
}
