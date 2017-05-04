/**
 *	https://github.com/march1993/image-recycler
 */

(function () {
	'use strict';

	var ImageRecycler = function (dom, image_url_getter) {

		if (window.history !== undefined && 'scrollRestoration' in window.history) {

			history.scrollRestoration = 'manual';

		}

		this.aflicker = 300;

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
		dom.style.position = 'relative';
		dom.style.left = '0';
		dom.style.top = '0';
		dom.parentElement.scrollTop = 0;

		this.onscroll = function (e) {

			this.need_update = true;

		}.bind(this);
		window.document.addEventListener('scroll', this.onscroll, false);

		// requestAnimationFrame
		this.dummy_next = function (timestamp) {

			// fix when iOS Safari changes window.innerHeight (e.g. hides address bar)
			if (this.dom.parentElement === window.document.body) {

				var
					last_inner_height = this.last_inner_height || 0,
					cur_inner_height = window.innerHeight;

				if (cur_inner_height !== last_inner_height) {

					this.need_update = true;

				}

				this.last_inner_height = cur_inner_height;

			}

			if (!this.disposed) {

				this.raf(this.dummy_next);
				this.animate(timestamp);

			}

		}.bind(this);
		this.raf = window.requestAnimationFrame.bind(window);
		this.raf(this.dummy_next);

		// Resize Event
		this.onresize = function (e) {

			this.need_update = true;

		}.bind(this);

		// Click Event
		this.onclick = function (e) {

			this.click_handler(e);

		}.bind(this);

		dom.addEventListener('click', this.onclick, false);
		window.addEventListener('resize', this.onresize);
		window.addEventListener('orientationchange', this.onresize);
		this.onresize(null);

	};

	ImageRecycler.prototype.click_handler = function (e) {

		var
			offset_y = (e.offsetY - this.aflicker) * this.pixel_ratio,
			offset = this.cur_offset;

		for (var i = 0; i < this.loop.length; i++) {

			offset += this.loop[i].height;

			if (offset_y <= offset) {

				var a = window.document.createElement('a');
				a.href = this.loop[i].href;
				a.target = '_blank';
				var click = window.document.createEvent('MouseEvents');
				click.initMouseEvent('click', true, true);
				a.dispatchEvent(click);

				i = this.loop.length;

			}

		}



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

		this.dom.removeEventListener('click', this.onclick, false);
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

					this.ctx.drawImage(item.image, 0, offset + this.aflicker * this.pixel_ratio, item.width, item.height);

				} else {

					// dummy
					this.ctx.fillStyle = '#ccc';
					this.ctx.fillRect(0, offset + this.aflicker * this.pixel_ratio, item.width, item.height);

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
		var parent = this.dom.parentElement;

		this.last_top = parent.scrollTop;

		this.dom.style.top = (this.last_top - this.aflicker) + 'px';
	};

	ImageRecycler.prototype.update_layout = function () {

		var dom = this.dom;

		var
			dom_w = dom.offsetWidth,
			dom_h = dom.offsetHeight + 2 * this.aflicker;

		if (dom.parentElement === window.document.body) {

			// additional 200 to avoid flickering
			var real_height = window.innerHeight + 2 * this.aflicker;
			dom.style.height = real_height + 'px';
			dom_h = real_height;

		}

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


		// bug fix: relocate the first element to align the baseline when scrolled to the top
		if (this.dom.parentElement.scrollTop === 0) {

			this.fix_first_insight();

			if (this.first_insight_offset > 0) {

				var delta = parseInt(this.first_insight_offset * 0.2);

				if (delta === 0) {

					delta = 1;

				}

				this.first_insight_offset -= delta;

				this.restore_first_insight();

				this.need_update = true;

			}

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

		// console.log('fix first insight', idx, offset);

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