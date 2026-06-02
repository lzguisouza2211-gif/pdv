(function () {
  'use strict';

  var COPA_COLORS = ['#0E8C4A', '#FFCC29', '#2A3F8F', '#F4581C', '#fff', '#0A6E3A', '#FFE800'];

  function getLayer() {
    var el = document.getElementById('copa-fx-layer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'copa-fx-layer';
      el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:65;overflow:hidden;';
      document.body.appendChild(el);
    }
    return el;
  }

  function burstAt(cx, cy, opts) {
    opts = opts || {};
    var count = opts.count !== undefined ? opts.count : 20;
    var power = opts.power !== undefined ? opts.power : 1;
    var colors = opts.colors || COPA_COLORS;
    var layer = getLayer();

    for (var i = 0; i < count; i++) {
      (function (color, angle, speed, sz, spin) {
        var el = document.createElement('div');
        var vx = Math.cos(angle) * speed;
        var vy = Math.sin(angle) * speed - 55 * power;
        el.style.cssText =
          'position:absolute;left:' + cx + 'px;top:' + cy + 'px;' +
          'width:' + sz + 'px;height:' + Math.round(sz * 0.45) + 'px;' +
          'background:' + color + ';border-radius:2px;pointer-events:none;will-change:transform,opacity;';
        layer.appendChild(el);
        var start = performance.now();
        var dur = 700 + Math.random() * 500;
        function tick(now) {
          var t = (now - start) / dur;
          if (t >= 1) { el.remove(); return; }
          var x = vx * t;
          var y = vy * t + 310 * t * t;
          var opacity = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
          el.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + (spin * t) + 'deg)';
          el.style.opacity = opacity;
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      })(
        colors[i % colors.length],
        Math.random() * Math.PI * 2,
        (65 + Math.random() * 115) * power,
        6 + Math.random() * 7,
        (Math.random() - 0.5) * 600
      );
    }
  }

  function flyBallToBag(cx, cy) {
    var bag = document.getElementById('copa-bagbar');
    var tx = window.innerWidth / 2;
    var ty = window.innerHeight - 56;
    if (bag) {
      var r = bag.getBoundingClientRect();
      tx = r.left + r.width * 0.5;
      ty = r.top + r.height * 0.5;
    }
    var el = document.createElement('div');
    el.style.cssText =
      'position:fixed;left:' + cx + 'px;top:' + cy + 'px;' +
      'width:28px;height:28px;font-size:22px;line-height:28px;text-align:center;' +
      'pointer-events:none;z-index:9999;will-change:transform,opacity;';
    el.textContent = '⚽';
    document.body.appendChild(el);
    var dx = tx - cx;
    var dy = ty - cy;
    var dur = 500;
    var start = performance.now();
    function tick(now) {
      var t = Math.min((now - start) / dur, 1);
      if (t >= 1) {
        el.remove();
        burstAt(tx, ty, { count: 8, power: 0.4, colors: ['#FFCC29', '#0E8C4A', '#fff'] });
        return;
      }
      var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      var arc = -Math.sin(Math.PI * t) * Math.min(Math.abs(dy) * 0.65, 110);
      var x = dx * ease;
      var y = dy * ease + arc;
      var scale = 1 - t * 0.45;
      el.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
      el.style.opacity = t > 0.78 ? String(1 - (t - 0.78) / 0.22) : '1';
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    if (navigator.vibrate) navigator.vibrate(30);
  }

  function goal(text) {
    text = text || 'GOOOL!';

    // flash verde
    var flash = document.createElement('div');
    flash.style.cssText =
      'position:fixed;inset:0;background:rgba(14,140,74,0.22);pointer-events:none;z-index:9998;' +
      'transition:opacity 0.3s;';
    document.body.appendChild(flash);
    setTimeout(function () {
      flash.style.opacity = '0';
      setTimeout(function () { flash.remove(); }, 320);
    }, 180);

    // banner
    var banner = document.createElement('div');
    banner.style.cssText =
      'position:fixed;top:50%;left:50%;' +
      'transform:translate(-50%,-50%) scale(0.35);' +
      'background:linear-gradient(135deg,#0E8C4A,#0A6E3A);' +
      'color:#FFCC29;font-size:36px;font-weight:900;' +
      'font-family:system-ui,-apple-system,sans-serif;' +
      'letter-spacing:4px;padding:16px 36px;border-radius:20px;' +
      'box-shadow:0 8px 40px rgba(0,0,0,0.45),0 0 0 4px #FFCC29;' +
      'pointer-events:none;z-index:9999;' +
      'text-shadow:0 2px 8px rgba(0,0,0,0.3);white-space:nowrap;' +
      'transition:transform 0.28s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.35s;';
    banner.textContent = text;
    document.body.appendChild(banner);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.style.transform = 'translate(-50%,-50%) scale(1)';
      });
    });

    // chuva de confete
    for (var i = 0; i < 55; i++) {
      (function (delay) {
        setTimeout(function () {
          burstAt(Math.random() * window.innerWidth, 0, { count: 2, power: 0.28 });
        }, delay);
      })(i * 42);
    }

    setTimeout(function () {
      banner.style.opacity = '0';
      banner.style.transform = 'translate(-50%,-50%) scale(1.08)';
      setTimeout(function () { banner.remove(); }, 400);
    }, 1900);

    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
  }

  function fireworks() {
    var spots = [
      [0.2, 0.3], [0.5, 0.15], [0.8, 0.25],
      [0.35, 0.5], [0.65, 0.38], [0.15, 0.62],
      [0.85, 0.55], [0.5, 0.72],
    ];
    spots.forEach(function (pos, i) {
      setTimeout(function () {
        burstAt(pos[0] * window.innerWidth, pos[1] * window.innerHeight, {
          count: 28, power: 1.3,
        });
      }, i * 200);
    });
    if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 80, 40, 200]);
  }

  // garante que a layer existe ao carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', getLayer);
  } else {
    getLayer();
  }

  window.CopaFX = {
    burstAt: burstAt,
    flyBallToBag: flyBallToBag,
    goal: goal,
    fireworks: fireworks,
  };
})();
