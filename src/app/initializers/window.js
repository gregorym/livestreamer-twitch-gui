define( [ "nwGui", "nwWindow", "ember" ], function( nwGui, nwWindow, Ember ) {

	var get = Ember.get,
	    set = Ember.setProperties,
	    debounce = Ember.run.debounce;

	var concat = [].concat;

	var isWin = process.platform === "win32";

	var timeEvent  = 100,
	    timeIgnore = 1000,
	    ignore     = false;


	function deferEvent( thisArg, fn ) {
		var args = [ thisArg, fn ];
		return function() {
			// Ember.run.debounce( thisArg, fn, arguments..., time );
			debounce.apply( null, concat.apply( args, arguments ).concat( timeEvent ) );
		};
	}

	function save( params ) {
		set( this, params );
		this.save();
	}

	function onResize( width, height ) {
		if ( ignore ) { return; }
		save.call( this, {
			width : width,
			height: height
		});
	}

	function onMove( x, y ) {
		if ( ignore ) { return; }
		// double check: NW.js moves the window to
		// [    -8,    -8] when maximizing...
		// [-32000,-32000] when minimizing...
		if ( isWin && ( x === -8 && y === -8 || x === -32000 && x === -32000 ) ) { return; }
		save.call( this, {
			x: x,
			y: y
		});
	}

	function ignoreNextEvent() {
		ignore = true;
		debounce( unignoreNextEvent, timeIgnore );
	}

	function unignoreNextEvent() {
		ignore = false;
	}


	function restoreWindow() {
		var width  = get( this, "width" ),
		    height = get( this, "height" );
		if ( width !== null && height !== null ) {
			nwWindow.resizeTo( width, height );
		}

		var x = get( this, "x" ),
		    y = get( this, "y" );
		if ( x !== null && y !== null ) {
			nwWindow.moveTo( x, y );
		}
	}

	function resetWindow() {
		save.call( this, {
			width : null,
			height: null,
			x     : null,
			y     : null
		});
	}


	Ember.Application.initializer({
		name: "window",
		after: [ "store", "nwjs" ],

		initialize: function( container, application ) {
			var store = container.lookup( "store:main" );

			// wait for the promise to resolve first
			application.deferReadiness();

			store.find( "window" )
				.then(function( records ) {
					return records.content.length
						? records.objectAt( 0 )
						: store.createRecord( "window", { id: 1 } ).save();
				})
				.then(function( Window ) {
					container.register( "record:window", Window, { instantiate: false } );

					// reset window
					if ( nwGui.App.fullArgv.indexOf( "--reset-window" ) >= 0 ) {
						resetWindow.call( Window );
					} else {
						restoreWindow.call( Window );
					}

					// also listen for the maximize events
					// we don't want to save the window size+pos after these events
					nwWindow.on(   "maximize", ignoreNextEvent );
					nwWindow.on( "unmaximize", ignoreNextEvent );
					nwWindow.on(   "minimize", ignoreNextEvent );
					nwWindow.on(    "restore", ignoreNextEvent );

					// resize and move events need to be defered
					// the maximize events are triggered afterwards
					nwWindow.on( "resize", deferEvent( Window, onResize ) );
					nwWindow.on(   "move", deferEvent( Window, onMove   ) );

					// now we're ready
					application.advanceReadiness();
				});
		}
	});

});
