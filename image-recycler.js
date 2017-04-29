(function () {
	'use strict';

	var ImageRecycler = function (dom, image_url_getter) {

		// status
		this.dom = dom;
		this.ctx = dom.getContext('2d');
		this.image_url_getter = image_url_getter;
		this.disposed = false;
		this.need_update = true;
		this.loop = [];
		this.pixel_ratio = window.devicePixelRatio || 1.0;
		this.cur_offset = 0;

		var first_item = this.create_item(0);
		this.update_size_item(first_item);
		this.loop.push(first_item);

		// DOM CSS
		dom.style.width = '100%';
		dom.style.height = '100%';
		dom.style.position = 'fixed';
		dom.style.left = '0';
		dom.style.top = '0';

		this.onresize = function (e) {

			this.need_update = true;

		}.bind(this);

		window.addEventListener('resize', this.onresize);
		window.addEventListener('orientationchange', this.onresize);
		this.onresize(null);


		this.dummy_next = function (timestamp) {

			if (!this.disposed) {

				this.raf(this.dummy_next);
				this.animate(timestamp);

			}

		}.bind(this);
		this.raf = window.requestAnimationFrame.bind(window);
		this.raf(this.dummy_next);


		// Scroller
		var scroller = window.document.createElement('div');
		scroller.style.width = '100%';
		scroller.style.height = '200%';
		scroller.style.position = 'absolute';
		scroller.style.top = '-50%';
		scroller.style.left = '0';
		dom.parentElement.insertBefore(scroller, dom.nextSibling);

		this.onscroll = function (e) {

			this.need_update = true;

		}.bind(this);
		window.document.addEventListener('scroll', this.onscroll, false);

	};

	ImageRecycler.prototype.animate = function (timestamp) {

		if (this.need_update) {

			this.need_update = false;

			this.update_scroll();
			this.update_layout();
			this.render();

		}


	};

	ImageRecycler.prototype.dispose = function () {

		window.document.removeEventListener('scroll', this.onscroll, false);
		window.removeEventListener('resize', this.onresize);
		window.removeEventListener('orientationchange', this.onresize);

		this.disposed = true;

	};

	ImageRecycler.prototype.render = function () {

		var offset = this.cur_offset;

		this.loop.forEach(function (item) {

			var in_sight = (offset + item.height) >= 0 && offset <= this.dom.height;

			if (in_sight) {

				// draw

				if (item.loaded) {

					this.ctx.drawImage(item.image, 0, offset, item.width, item.height);

				} else {

					// dummy
					this.ctx.fillStyle = 'green';
					this.ctx.fillRect(0, offset, item.width, item.height);

				}


			}


			offset += item.height;

		}.bind(this));

	};

	ImageRecycler.prototype.update_scroll = function () {

		var
			last_top = this.last_top || 0,
			cur_top = this.dom.parentElement.scrollTop;

		var delta = (cur_top - last_top) * this.pixel_ratio;
		this.cur_offset -= delta;

		var eighth = this.dom.offsetHeight / 8;

		if (cur_top > eighth * 3) {

			this.dom.parentElement.scrollTop -= eighth;

		}

		if (cur_top < eighth) {

			this.dom.parentElement.scrollTop += eighth;

		}

		this.last_top = this.dom.parentElement.scrollTop;

	};

	ImageRecycler.prototype.update_layout = function () {

		var dom = this.dom;

		var
			dom_w = dom.offsetWidth,
			dom_h = dom.offsetHeight;

		dom.height = dom_h * this.pixel_ratio;
		dom.width = dom_w * this.pixel_ratio;

		this.fix_first_insight();
		this.update_size();
		this.restore_first_insight();

		while (this.cur_offset > - dom.height) {

			var item = this.create_item(this.loop[0].idx - 1);
			this.loop.unshift(item);
			this.update_size_item(item);
			this.cur_offset -= item.height;

		}

		while (this.cur_offset < - 2 * dom.height && (this.cur_offset + this.loop[0].height) < - 2 * dom.height) {

			var to_remove = this.loop.shift();
			this.cur_offset += to_remove.height;
			this.remove_item(to_remove);

		}

		var end_pos = this.cur_offset + this.get_total_height();
		while (end_pos < dom.height) {

			var item = this.create_item(this.loop[this.loop.length - 1].idx + 1);
			this.loop.push(item);
			this.update_size_item(item);
			end_pos += item.height;

		}

		while (end_pos > 2 * dom.height && (end_pos -= this.loop[this.loop.length - 1].height) > 2 * dom.height) {

			var to_remove = this.loop.pop();
			end_pos -= to_remove.height;
			this.remove_item(to_remove);

		}

	};

	ImageRecycler.prototype.get_total_height = function () {

		var height = 0;

		this.loop.forEach(function (item) {

			height += item.height;

		})

		return height;

	};

	ImageRecycler.prototype.fix_first_insight = function () {

		this.first_insight = null;
		this.first_insight_offset = 0;

		var offset = this.cur_offset;
		var idx = 0;

		while (offset < 0 && idx < this.loop.length) {

			offset += this.loop[idx].height;
			idx += 1;

		}

		this.first_insight = idx;
		this.first_insight_offset = offset;

	};

	ImageRecycler.prototype.restore_first_insight = function () {

		var offset = this.cur_offset;

		for (var idx = 0; idx < this.first_insight; idx += 1) {

			offset += this.loop[idx].height;

		}

		this.cur_offset += this.first_insight_offset - offset;

	};

	ImageRecycler.prototype.update_size = function () {

		this.loop.forEach(function (item) {

			this.update_size_item(item);

		}.bind(this));

	};

	ImageRecycler.prototype.update_size_item = function(item) {

		item.width = this.dom.width;

		if (item.loaded) {

			item.height = parseInt(item.width * item.image.height / item.image.width);

		} else {

			item.height = parseInt(item.width * 0.618);
		}

	};

	ImageRecycler.prototype.create_item = function (idx) {

		var item = this.image_url_getter(idx);
		item.idx = idx;
		item.loaded = false;

		var image = new Image();
		item.image = image;

		image.addEventListener('load', function (e) {

			if (! item.removed) {

				item.loaded = true;
				this.need_update = true;

			}

		}.bind(this));

		image.src = item.url;

		return item;

	};

	ImageRecycler.prototype.remove_item = function (item) {

		item.removed = true;
		item.image.src = '';

	};


	window.ImageRecycler = ImageRecycler;

}) ();