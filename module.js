angular.module('hsa_window', [])
.factory('hsaw', function ($window) {
	var windows = {};
	var ret = {};
	var cnt = Number.MIN_VALUE;
	var cbs = {};
	var queue = {};
	var started = false;
	var identity = null;

	function listener (e) {
		if (e.source === $window || !e.data) return;
		var source = e.source;
		var mess;
		try {
			mess = JSON.parse(e.data);
		}catch (e) {return;}
    console.log('MESSAGE IS ',mess, e.source);

		var cb = (mess.cb) ? function () {
			source.postMessage(JSON.stringify({'__type':'system', 'command': 'answer', data:arguments, cb: mess.cb}), source.location.origin);
			console.log('==>', mess.cb, arguments);
		} : undefined;

		if (mess['__type'] == 'system') {
			switch (mess.command) {
				case 'identify': {
					identity = mess.name; 
					cb (0);
					break;
				};
				case 'answer':{
					var c = cbs[mess.cb];
					delete cbs[mess.cb];
					if (!c || 'function' === typeof(c)) {
						var dd = [];
						for (var i in mess.data) {
							dd[i] = mess.data[i];
						}
						c.apply (null,dd);
					}
					break;
				}
			}
			return;
		}
		if (mess['__type'] == 'message') {
			var d = mess.data;
			var args = [d];
			cb && args.push(cb);
			for (var i in monitors) {
				('function' === typeof(monitors[i]))  && monitors[i].apply(null, args);
			}
			return;
		}
	}
	ret.window_name = function () {return identity;}
	ret.start = function () {
		if (started) return;
		started = true;
		if ($window.addEventListener) {
			$window.addEventListener('message', listener, true);
		}else{
			$window.attachEvent('onmessage', listener);
		}
	}
	///moze ovo bolje, ali neka ga za sad ...
	var monitors = [];
	ret.unmonitor = function (index) {
		ret.monitors[index] = undefined;
	}

	ret.monitor = function (cb) {
		return monitors.push(cb) - 1;
	};

	ret.isReady = function (alias) {
		return (windows[alias] && !windows[alias].closed);
	}

	ret.close = function (alias) {
		if (!this.isReady(alias)) return;
		windows[alias].window.close();
		delete windows[alias];
	}

	function empty_queue (alias) {
		while (windows[alias] && windows[alias].queue.length) {
			var item = windows[alias].queue.shift();
			send(alias, item);
		}
		console.log('done with queue release');
	}

	ret.create = function (alias, url, specs, replace) {
		(windows[alias]) && this.close(alias);
		windows[alias] = {window:$window.open(url, specs, replace), pending: true, queue : []}
		var self = this;
		jQuery(windows[alias].window).on ('beforeunload', function (){
			delete windows[alias];
		});
		windows[alias].window.onload = function () {
			windows[alias].pending = false;
			empty_queue(alias);
		}

		send(alias, {'__type':'system','command':'identify', name: alias}, function (s) {
		});
		return this.get(alias);
	}

	function send (alias, messobj, cb) {
		///make some space for callbacks ... TODO
		var to_send = messobj;
    var target = (alias === 'parent') ? {'window':$window.opener, pending:false} : windows[alias];
    if (!target) return;

		if ('function' === typeof(cb)) {
			cnt++;
			if (cnt == Number.MAX_VALUE) cnt = Number.MIN_VALUE;
			cbs[cnt] = cb;
			to_send.cb = cnt;
		}
		if (target.pending && target !== parent) {
			target.queue.push (to_send);
		}else{
			target.window.postMessage(JSON.stringify(to_send), $window.location.origin);
		}
	}

	ret.get = function (alias) {
		var self = this;
		return {
			send: function (messobj, cb) {
				return send(alias, {'__type':'message', data:messobj}, cb);
			},
			close: function () {
				return self.close(alias);
			},
			isReady: function () {
				return self.isReady(alias);
			}
		}
	}


	return ret;
})
.run(function (hsaw) {
	hsaw.start();
	console.log('started');
});
