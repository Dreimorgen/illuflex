/**********************************************
 * the config object
 */
var config = {
  // the buffer space the elements are allowed to
  // float past the end of the canvas before they
  // are put back on the other side
  negativeBufferSpace: 100,
  // should illuflex display warnings/errors
  debug: false,
  // this is the no of units the canvas contains.
  // it is resized to fit the screen anyway so this
  // can't be translated to pixels exactly
  cWidth: 1000,
  cHeight: 750
};

 /**********************************************
 * the screen state object
 */
var IFScreen = {
  // is the tab active
  isActive: true,
  // is it a mobile device
  isMobile: function () {
    return window.innerWidth < 639;
  },
  // the height of the window
  height: function () {
    return Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight,
      window.innerHeight
    );
  },
  // the width of the window
  width: function () {
    return Math.max(
      window.innerWidth,
      document.documentElement.clientWidth
    );
  }
};

// register the events to update the IFScreen.isActive
window.onfocus = function () {
  IFScreen.isActive = true;
}
window.onblur = function () {
  IFScreen.isActive = false;
}


/**********************************************
 * constructor
 */
function Illuflex( configObj, sources, sourceGetter, callback ) {
  if ( !this.exists( sources ) && config.debug ) console.log('WARNING! root sources object isn\'t defined!');
  this.callback = callback || false;

  // the defaults, these can/should be overwritten
  // when calling illuflex
  this.defaults = {
    renderConfig: {
      wobble: false,
      wobbleSpeed: 2000,
      background: false,
      defaultObjSettings: {
        em: 1,
        bg: '#000',
        anim: {
          reEnter: false,
          pulse: false,
          move: true,
          rotate: false,
          easing: 'mina.easeinout',
          restlessness: 1,
          speed: 7,
          intensity: 10,
          tendency: {
            x: 0,
            y: 0,
            r: 0
          },
          negativeBufferSpace: config.negativeBufferSpace,
          scaling: {
            min: .95,
            max: 1.05
          }
        }
      }
    },
    illuConfig: {
      // without illuConfig passsed, no illus :(
    }
  };
  // set the canvas property
  this.canvas = {
    // integer incrementing on each wobble
    state: 0,
    // merge the defaults with the options we set when calling illuflex
    renderConfig: this.recursiveMerge( configObj.renderConfig, this.defaults.renderConfig ),
    illuConfig: ( !configObj.illuConfig ) ? this.defaults.illuConfig : configObj.illuConfig,
    // paper is the actual Raphael object
    paper: Snap( '#canvas' ),
    // an arraw for all the drawn illu objects
    elements: []
  };
  if ( config.debug ) console.log('Illuflex initialised!');

  // get the sources, if there are sources
  if ( sources && sourceGetter )
    this.getSources( sources, sourceGetter );


  // draw the background, if there is one defined
  if ( this.canvas.renderConfig.background )
    this.drawBackground();

  // draw the illu objects
  this.drawIllus();
}

/***********************
 * checks if a variable is defined
 */
Illuflex.prototype.exists = function( variable ) {
  if ( typeof( variable ) == 'undefined' )
    return false;
  else
    return true;
}

/***********************
 * merges two objects and returns the resulting object (non-destructive)
 */
Illuflex.prototype.recursiveMerge = function( targetObject, sourceObject ) {
  var R = {};
  for (var p in sourceObject) {
    try {
      if ( sourceObject[p].constructor == Object) {
        R[p] = arguments.callee( targetObject[p], sourceObject[p] );
      } else {
        R[p] = ( typeof( targetObject[p] ) !== 'undefined' ) ? targetObject[p] : sourceObject[p];
      }
    } catch(e) {
      R[p] = sourceObject[p];
    }
  }
  return R;
}

/***********************
 * returns a random position on the screen
 */
Illuflex.prototype.randPos = function () {
  var pos = {
    x: parseInt( Math.floor( ( Math.random() * config.cWidth ) - config.negativeBufferSpace ) ),
    y: parseInt( Math.floor( ( Math.random() * config.cHeight ) - config.negativeBufferSpace ) ),
    r: parseInt( Math.floor( Math.random() * 360 ) )
  };
  return pos;
}

/***********************
 * mixin to efficiently create illus based on a single path
 */
Illuflex.prototype.pathConstructor = function( path, settings, name ) {
  var body = this.canvas.paper.path( path ).attr({ fill: settings.bg, 'stroke-width': 0 });
  var group = this.canvas.paper.g( body );
  return this.groupTransform( group, settings, name );
}

/***********************
 * mixin to efficiently transform a group of objects and set the group class
 */
Illuflex.prototype.groupTransform = function( group, settings, name, atoms ) {
  var hasAtoms = atoms || false;
  var tstr = 't'+settings.pos.x+','+settings.pos.y+' r'+settings.pos.r+' s'+settings.em;
  return group.transform(tstr).attr({ 'class': name, 'hasAtoms': hasAtoms });
}

/***********************
 * mixin to efficiently pass settings to the atomObjs
 */
Illuflex.prototype.atomSettings = function( bg, em, x, y, r ) {
  return {
    bg: bg,
    em: em,
    pos: {
      x: x,
      y: y,
      r: r
    }
  };
}

/***********************
 * Get element configuration by the element name
 */
Illuflex.prototype.getConfig = function( elName ) {
  for ( key in this.canvas.illuConfig ) { // cycle through the illuConfig
    if ( this.canvas.illuConfig[key].name === elName ) {
      var config = this.canvas.illuConfig[key];
      var defaults = this.defaults.renderConfig.defaultObjSettings;
      // merge config with defaults to get the complete config
      return this.recursiveMerge( config, defaults );
    }
  };
}

/***********************
 * the wobble function which is called regularly
 */
Illuflex.prototype.wobble = function () {
  for (var i = this.canvas.elements.length - 1; i >= 0; i--) { // cycle all elements
    var el = this.canvas.elements[i], // get the element
        elName = el.attr('class'), // get the name
        hasAtoms = el.attr('hasAtoms'),
        elConfig = this.getConfig( elName ); // get the config via the getConfig function

    if ( !elConfig ) continue; // elConfig doesn't exist
    if ( !this.exists( elConfig.anim ) ) continue; // anim doesn't exist
    if ( elConfig.anim === false ) continue; // anim is set to false

    if ( hasAtoms === 'true' ) { // this consists of atoms
      for (var j = el.node.children.length - 1; j >= 0; j--) { // cycle over the child elements
        var thisAtom = el[j]; // this is the child

        if ( thisAtom.attr('isAnimated') === 'true' ) continue; // if it isn't animated go on, else go to the next child

        if ( elConfig.anim.reEnter ) { // if reEnter is true
          // check for overflows, makes them appear at the oppsite side, dont' animate but continue
          if ( thisAtom.overflowReset( this.defaults.renderConfig.defaultObjSettings.anim.negativeBufferSpace ) ) continue;
        }

        var currentMatrix = thisAtom.transform().localMatrix; // get the current matrix
        var newSettings = this.calculateAnim( elConfig.anim, thisAtom.getBBox() ); // calculateAnim returns an array with the new settings or false
        var newMatrix = ( newSettings ) ? currentMatrix.translate( newSettings.x,newSettings.y ).rotate( newSettings.r ).scale( newSettings.s ) : null; // apply the new settings to the current matrix, if they aren't false
        if ( !newSettings ) continue; // returns false if no matrix could be calculated
        thisAtom.attr('isAnimated', 'true'); // set the status to animated
        var S = newSettings.speed * ( ( Math.random() * 500 ) + 200 ); // calculate the speed
        thisAtom.animate({ 'transform': newMatrix  }, S, mina.easeinout, function () { // apply the new matrix with animation
          this.animCallback();
        });
      };
      
    } else { // this doesn't consist of atoms

      if ( el.attr('isAnimated') === 'true' ) continue; // it's currently animated, go to the next element

      if ( elConfig.anim.reEnter ) { // if reEnter is true
        // check for overflows, makes them appear at the oppsite side, dont' animate but continue
        if ( el.overflowReset( this.defaults.renderConfig.defaultObjSettings.anim.negativeBufferSpace ) ) continue;
      }

      var currentMatrix = el.transform().localMatrix; // get the current matrix
      var newSettings = this.calculateAnim( elConfig.anim, el.getBBox() ); // calculateAnim returns an array with the new settings or false
      var newMatrix = ( newSettings ) ? currentMatrix.translate( newSettings.x, newSettings.y ).rotate( newSettings.r ).scale( newSettings.s ) : null; // apply the new settings to the current matrix, if they aren't false
      if ( !newSettings ) continue; // returns false if no matrix could be calculated
      el.attr('isAnimated', 'true'); // set the status to animated
      var S = newSettings.speed * ( ( Math.random() * 500 ) + 200 ); // calculate the speed
      el.animate({ 'transform': newMatrix  }, S, mina.easeinout, function () { // apply the new matrix with animation
        this.animCallback();
      });
    }
  }; // end cycling of elements
}


/***********************
 * calculating the new transformation data for the illu
 */
Illuflex.prototype.calculateAnim = function( c, bbox ) {
  var x, y, r, s;

  // if restlessness is set to 1, the chance of an animation is 50%
  if ( Math.random() < c.restlessness/2 ) {
    // we should move
    if ( c.move ) {
      if ( c.tendency.x !== 0 ) { // tendency isn't zero
        x = Math.random() * c.tendency.x * c.intensity;
      } else { // tendency is zero, randomise if positive or negative
        x = ( Math.random() < .5 ) ? Math.random() * c.intensity * -1 : Math.random() * c.intensity;
      }
      if ( c.tendency.y !== 0 ) { // tendency isn't zero
        y = Math.random() * c.tendency.y * c.intensity;
      } else { // tendency is zero, randomise if positive or negative
        y = ( Math.random() < .5 ) ? Math.random() * c.intensity * -1 : Math.random() * c.intensity;
      }
    } else { // we shouldnt move
      x = 0;
      y = 0;
    }
    if ( c.rotate ) { // we should rotate
      if ( c.tendency.r !== 0 ) { // tendency isn't zero
        r = Math.random() * c.tendency.r * c.intensity;
      } else { // tendency is zero, randomise if positive or negative
        r = ( Math.random() < .5 ) ? Math.random() * c.intensity * -1 : Math.random() * c.intensity;
      }
    } else { // we shouldn't rotate
      r = 0;
    }
    if ( c.pulse ) { // we should pulse
      s = Math.random() * ( c.scaling.max - c.scaling.min ) + c.scaling.min;
    } else { // we shouldn't pulse
      s = 1;
    }

    return {
      'x': x,
      'y': y,
      'r': r,
      's': s,
      'speed': c.speed * Math.random()
    };
  } else {
    return false;
  }
}

/***********************
 * getting the source referenced via the instantiation of the illuflex object
 */
Illuflex.prototype.getSources = function( sources, sourceGetter ) {
  // call the getter function to fill the referenced sources object
  eval( sourceGetter )( this );

  // use the references to actually set the sources property
  this.sources = {
    atomObjs: eval(sources.atomObjs),
    constructorObjs: eval(sources.constructorObjs)
  };
  if ( config.debug ) console.log('Got Sources!');
}

Illuflex.prototype.drawBackground = function () {
  var bg = ( this.exists( this.canvas.renderConfig.background ) ) ? this.canvas.renderConfig.background : this.defaults.renderConfig.background;
  var bg = ( bg.substr(0,1) === '#' ) ? bg : this.canvas.paper.gradient( bg );

  if ( bg !== false ) {
    if ( config.debug ) console.log('Drawing background! ['+bg+']');
    var bgContainer = this.canvas.paper.rect(0,0, config.cWidth, config.cHeight ).attr({ 'class': 'canvas-background', fill: bg, 'stroke-width': 0 });
  }
}


/***********************
 * drawing the illus
 */
Illuflex.prototype.drawIllus = function () {
  // cycle illuConfig and render the files accordingly
  for (var i = this.canvas.illuConfig.length - 1; i >= 0; i--) {
    var theObj = this.canvas.illuConfig[i]
    if ( !this.exists( theObj.type ) ) {
      // no type defined, this is illegal
      if ( config.debug ) console.log('ERROR! no type defined!');
      return false;
    } else {
      if ( config.debug ) console.log('Now drawing '+theObj.type + ( (theObj.type === 'raw') ? ' ['+theObj.path+']' : '' ) );
    }

    // write the settings object …
    var randPos = this.randPos();
    // pos doesnt exist at all and must be totally random
    var pos = ( this.exists( theObj.pos ) ) ? theObj.pos : randPos;
    // make sure the pos object is filled, if some of it was defined
    var pos = {
      x: ( this.exists( pos.x ) ) ? pos.x : randPos.x,
      y: ( this.exists( pos.y ) ) ? pos.y : randPos.y,
      r: ( this.exists( pos.r ) ) ? pos.r : randPos.r
    };
    var settings = {
      // xyzr (pos) and bg are randomly set if they aren't defined
      pos: pos,
      // if bg is defined, use, if not use random, if it begins with # use that, else create a gradient with that string
      bg: ( !theObj.bg ) ? this.defaults.renderConfig.defaultObjSettings.bg : ( theObj.bg.substr(0, 1) != '#' ) ? this.canvas.paper.gradient(theObj.bg) : theObj.bg,
      // em and anim are set via the defaultss if they aren't defined
      em: ( !this.exists( theObj.em ) ) ? this.defaults.renderConfig.defaultObjSettings.em : theObj.em,
      // if anim is defined used it, else use the defaults object setting
      anim: ( theObj.anim != 'undefined') ? theObj.anim : this.defaults.renderConfig.defaultObjSettings.anim
    };

    // if the type isnt set to raw
    if ( theObj.type != 'raw' ) {
      if ( !this.exists( this.sources ) ) continue;
      if ( !this.exists( this.sources.constructorObjs ) ) continue;
      if ( !this.exists( this.sources.atomObjs ) ) continue;

      // pass the settings object to the constructor
      this.canvas.elements.push( this.sources.constructorObjs[theObj.type]( settings, theObj.name ) );
    // if the type is set to raw
    } else {
      // if the path property isnt set
      if ( !this.exists( theObj.path ) ) {
        if ( config.debug ) console.log('ERROR! the object type is set to raw but the path property isn\'t set!');
      } else if ( !this.exists( theObj.name ) ) {
        if ( config.debug ) console.log('ERROR! the object type is set to raw but the name property isn\'t set!');
      } else {
        // simply call the pathconstructor to use the path property
        this.canvas.elements.push( this.pathConstructor( theObj.path, settings, theObj.name ) );
      }
    }
  };
  this.illusDrawnCallback();
}

/***********************
 * called when the illus have been drawn
 */
Illuflex.prototype.illusDrawnCallback = function () {
  var g = this.canvas.paper.g().attr('class', 'illu-group');
  // initially all elements should have isAnimated set to false
  for (var i = this.canvas.elements.length - 1; i >= 0; i--) {
    g.add( this.canvas.elements[i].attr('isAnimated', 'false') );
  };
  var t = this;
  if ( config.debug ) console.log('drawn illus!');
  
  // run callback
  if ( this.callback !== false ) {
    if ( config.debug ) console.log('callback called!')
    this.callback();
  }

  // start wobble
  if ( !t.canvas.renderConfig.wobble ) return; // shouldn't wobble, so just return
  if ( config.debug ) console.log('… now wobbling every ' + this.canvas.renderConfig.wobbleSpeed + 'ms …')
  setInterval( function () { // continually call wobble
    if ( IFScreen.isActive ) // if the window is active
      t.wobble();
  }, t.canvas.renderConfig.wobbleSpeed );

  
}

// proper snap plugins:
Snap.plugin(function (Snap, Element, Paper, global) {
  /***********************
   * called when the illu stopped animating
   */
  Element.prototype.animCallback = function () {
    return this.attr('isAnimated', 'false'); // set the status to not animated
  };

  /***********************
   * checks wether an element went over the border
   * returns an object with the sides, true for each overflowing side
   */
  Element.prototype.overflow = function ( buffer ) {
    var bbox = this.getBBox();

    var overflow = {
      right: false,
      bottom: false,
      left: false,
      top: false
    };

    // check for overflows
    if ( bbox.x > ( config.cWidth + buffer + bbox.w ) ) { // left border is larger than the width (overflow right)
      overflow.right = true;
    }
    if ( bbox.y > ( config.cHeight + buffer + bbox.h ) ) { // top border is larger than the height (overflow bottom)
      overflow.bottom = true;
    }
    if ( bbox.x < -( buffer + bbox.w ) ) { // right border is smaller than 0 (overflow left)
      overflow.left = true;
    }
    if ( bbox.y2 < -( buffer + bbox.h ) ) { // bottom border is smaller than 0 (overflow top)
      overflow.top = true;
    }
    return overflow;
  };

  /***********************
   * puts the overflowed element on the opposite side
   */
  Element.prototype.overflowReset = function ( buffer ) {
    var S = this.transform().localMatrix.d;
    var overflow = this.overflow( buffer );
    var pos = {
      x: '0',
      y: '0'
    };

    if ( overflow.left )
      pos.x = config.cWidth+this.getBBox().w;
      
    if ( overflow.right )
      pos.x = -this.getBBox().w*2;
      
    if ( overflow.top )
      pos.y = config.cHeight;
      
    if ( overflow.bottom )
      pos.y = -this.getBBox().h*2;

    if ( pos.x == 0 && pos.y == 0 ) { // nothing changed
      return false;
    } else {
      this.transform('T'+pos.x+','+pos.y+' s'+S);
      return true;
    }
  };

});