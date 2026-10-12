// All Chart.js set-up. Colours come from CSS custom properties so light/dark themes stay in styles.css.
(function (App) {
  'use strict';

  var instances = {};

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function groupColor(id) { return css('--g-' + id); }
  function typeColor(id) { return css('--t-' + id); }

  function withAlpha(hex, a) {
    var h = hex.replace('#', '');
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function gbp(v, dp) {
    return '£' + Number(v).toLocaleString('en-GB', { minimumFractionDigits: dp == null ? 2 : dp, maximumFractionDigits: dp == null ? 2 : dp });
  }

  function pct(v) { return (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%'; }

  function baseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: css('--tooltip-bg'),
          titleColor: css('--ink'),
          bodyColor: css('--ink-2'),
          footerColor: css('--ink'),
          borderColor: css('--border'),
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true
        }
      }
    };
  }

  function axis(extra) {
    return Object.assign({
      grid: { color: css('--grid'), drawTicks: false },
      border: { color: css('--axis') },
      ticks: { color: css('--muted'), padding: 6 }
    }, extra || {});
  }

  // Draws a text label just past the end of each bar (horizontal charts only).
  var endLabels = {
    id: 'endLabels',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.format) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.font = '12px ' + Chart.defaults.font.family;
      ctx.fillStyle = css('--ink-2');
      ctx.textBaseline = 'middle';
      chart.data.datasets.forEach(function (ds, di) {
        if (opts.datasets && opts.datasets.indexOf(di) === -1) return;
        chart.getDatasetMeta(di).data.forEach(function (bar, i) {
          ctx.fillText(opts.format(ds.data[i], i, di), bar.x + 6, bar.y);
        });
      });
      ctx.restore();
    }
  };

  // Writes the percentage inside stacked segments that are wide enough to hold it.
  var segmentLabels = {
    id: 'segmentLabels',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.enabled) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.font = '600 12px ' + Chart.defaults.font.family;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      chart.data.datasets.forEach(function (ds, di) {
        chart.getDatasetMeta(di).data.forEach(function (bar, i) {
          var w = Math.abs(bar.x - bar.base);
          var text = pct(ds.data[i] / 100);
          if (w < ctx.measureText(text).width + 12) return;
          ctx.fillStyle = ds.labelColor || css('--ink');
          ctx.fillText(text, (bar.x + bar.base) / 2, bar.y);
        });
      });
      ctx.restore();
    }
  };

  function make(id, config) {
    if (instances[id]) instances[id].destroy();
    var canvas = document.getElementById(id);
    if (!canvas) return null;
    instances[id] = new Chart(canvas, config);
    return instances[id];
  }

  function foodGroupsBySpend(s) {
    return App.GROUPS.slice().sort(function (a, b) { return s.byGroup[b.id].spend - s.byGroup[a.id].spend; });
  }

  function groupSpend(s) {
    var groups = foodGroupsBySpend(s);
    var food = s.totals.foodSpend;
    var opts = baseOptions();
    opts.indexAxis = 'y';
    opts.layout = { padding: { right: 110 } };
    opts.scales = {
      x: axis({ beginAtZero: true, ticks: { color: css('--muted'), callback: function (v) { return gbp(v, 0); } } }),
      y: axis({ grid: { display: false }, ticks: { color: css('--ink-2') } })
    };
    opts.plugins.tooltip.callbacks = {
      label: function (c) { return gbp(c.raw) + '  ·  ' + pct(c.raw / food) + ' of food spend'; }
    };
    opts.plugins.endLabels = { format: function (v) { return gbp(v, 0) + '  ' + pct(v / food); } };

    return make('chart-groups', {
      type: 'bar',
      plugins: [endLabels],
      data: {
        labels: groups.map(function (g) { return g.name; }),
        datasets: [{
          data: groups.map(function (g) { return s.byGroup[g.id].spend; }),
          backgroundColor: groups.map(function (g) { return groupColor(g.id); }),
          borderRadius: 4,
          barPercentage: 0.8,
          categoryPercentage: 0.85
        }]
      },
      options: opts
    });
  }

  function typeSplit(s) {
    var spendTotal = 0, itemTotal = 0;
    App.TYPES.forEach(function (t) { spendTotal += s.byType[t.id].spend; itemTotal += s.byType[t.id].items; });
    var opts = baseOptions();
    opts.indexAxis = 'y';
    opts.scales = {
      x: axis({ stacked: true, min: 0, max: 100, ticks: { color: css('--muted'), callback: function (v) { return v + '%'; } } }),
      y: axis({ stacked: true, grid: { display: false }, ticks: { color: css('--ink-2') } })
    };
    opts.plugins.tooltip.callbacks = {
      label: function (c) {
        var t = App.TYPES[c.datasetIndex];
        var detail = c.dataIndex === 0 ? gbp(s.byType[t.id].spend) : s.byType[t.id].items + ' items';
        return t.name + ': ' + pct(c.raw / 100) + '  (' + detail + ')';
      }
    };
    opts.plugins.segmentLabels = { enabled: true };

    return make('chart-types', {
      type: 'bar',
      plugins: [segmentLabels],
      data: {
        labels: ['Share of spend', 'Share of items'],
        datasets: App.TYPES.map(function (t) {
          return {
            label: t.name,
            data: [s.byType[t.id].spend / spendTotal * 100, s.byType[t.id].items / itemTotal * 100],
            backgroundColor: typeColor(t.id),
            labelColor: css('--t-' + t.id + '-ink'),
            borderColor: css('--surface'),
            borderWidth: { left: 0, right: 2, top: 0, bottom: 0 },
            borderSkipped: false,
            barPercentage: 0.75
          };
        })
      },
      options: opts
    });
  }

  // buckets: [{ label, byGroup }] - months by default, or days for a short timeframe.
  function monthly(s, includeNonfood, buckets) {
    buckets = buckets || s.period.months;
    var series = App.GROUPS.concat(includeNonfood ? [App.NONFOOD] : []);
    if (s.byGroup.unclassified.spend > 0) series = series.concat([App.UNCLASSIFIED]);
    var opts = baseOptions();
    opts.interaction = { mode: 'index', intersect: false };
    opts.scales = {
      x: axis({ stacked: true, grid: { display: false } }),
      y: axis({ stacked: true, beginAtZero: true, ticks: { color: css('--muted'), callback: function (v) { return gbp(v, 0); } } })
    };
    opts.plugins.tooltip.itemSort = function (a, b) { return b.datasetIndex - a.datasetIndex; };
    opts.plugins.tooltip.filter = function (c) { return c.raw > 0; };
    opts.plugins.tooltip.callbacks = {
      label: function (c) { return c.dataset.label + ': ' + gbp(c.raw); },
      footer: function (items) {
        var total = items.reduce(function (sum, c) { return sum + c.raw; }, 0);
        return 'Total: ' + gbp(total);
      }
    };

    return make('chart-monthly', {
      type: 'bar',
      data: {
        labels: buckets.map(function (m) { return m.label; }),
        datasets: series.map(function (g) {
          return {
            label: g.name,
            data: buckets.map(function (m) { return m.byGroup[g.id] || 0; }),
            backgroundColor: groupColor(g.id),
            borderColor: css('--surface'),
            borderWidth: { top: 1, bottom: 1, left: 0, right: 0 },
            borderSkipped: false,
            pointStyle: 'rectRounded',
            maxBarThickness: 44
          };
        })
      },
      options: opts
    });
  }

  function caloriesVsSpend(s) {
    var groups = foodGroupsBySpend(s);
    var food = s.totals.foodSpend;
    var kcal = s.nutrition.total.kcal;
    var opts = baseOptions();
    opts.indexAxis = 'y';
    opts.layout = { padding: { right: 48 } };
    opts.scales = {
      x: axis({ beginAtZero: true, ticks: { color: css('--muted'), callback: function (v) { return v + '%'; } } }),
      y: axis({ grid: { display: false }, ticks: { color: css('--ink-2') } })
    };
    opts.plugins.tooltip.callbacks = {
      label: function (c) { return c.dataset.label + ': ' + c.raw.toFixed(1) + '%'; }
    };
    opts.plugins.endLabels = { format: function (v) { return Math.round(v) + '%'; } };

    return make('chart-calories', {
      type: 'bar',
      plugins: [endLabels],
      data: {
        labels: groups.map(function (g) { return g.name; }),
        datasets: [
          {
            label: 'Share of food spend',
            data: groups.map(function (g) { return s.byGroup[g.id].spend / food * 100; }),
            backgroundColor: groups.map(function (g) { return groupColor(g.id); }),
            borderRadius: 4,
            barPercentage: 0.9,
            categoryPercentage: 0.8
          },
          {
            label: 'Share of calories bought',
            data: groups.map(function (g) { return s.byGroup[g.id].nutrients.kcal / kcal * 100; }),
            backgroundColor: groups.map(function (g) { return withAlpha(groupColor(g.id), 0.35); }),
            borderColor: groups.map(function (g) { return groupColor(g.id); }),
            borderWidth: 1.5,
            borderRadius: 4,
            barPercentage: 0.9,
            categoryPercentage: 0.8
          }
        ]
      },
      options: opts
    });
  }

  // Horizontal reference lines (target, average) drawn across the plot area.
  var refLines = {
    id: 'refLines',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.lines) return;
      var ctx = chart.ctx, area = chart.chartArea, y = chart.scales.y;
      ctx.save();
      opts.lines.forEach(function (l) {
        var py = y.getPixelForValue(l.value);
        if (py < area.top || py > area.bottom) return;
        ctx.strokeStyle = l.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash(l.dash || []);
        ctx.beginPath();
        ctx.moveTo(area.left, py);
        ctx.lineTo(area.right, py);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '600 11px ' + Chart.defaults.font.family;
        ctx.fillStyle = css('--ink-2');
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(l.label, area.right - 4, py - 3);
      });
      ctx.restore();
    }
  };

  function fortnightly(assessment, target, average) {
    var fmt = function (d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
    var rows = assessment.fortnights;
    var max = Math.max(target, average, Math.max.apply(null, rows.map(function (r) { return r.kcalPerDay; })));
    var opts = baseOptions();
    opts.scales = {
      x: axis({ grid: { display: false }, ticks: { color: css('--muted'), maxRotation: 0, autoSkipPadding: 12 } }),
      y: axis({
        beginAtZero: true, suggestedMax: max * 1.08,
        ticks: { color: css('--muted'), callback: function (v) { return v.toLocaleString('en-GB'); } }
      })
    };
    opts.plugins.tooltip.callbacks = {
      title: function (items) {
        var r = rows[items[0].dataIndex];
        return fmt(r.start) + ' – ' + fmt(r.end) + (r.days < 14 ? ' (' + r.days + ' days)' : '');
      },
      label: function (c) {
        return Math.round(c.raw).toLocaleString('en-GB') + ' kcal per person per day';
      },
      afterLabel: function (c) {
        var r = rows[c.dataIndex];
        return gbp(r.spend) + ' of food & drink bought · ' + pct(c.raw / target) + ' of target';
      }
    };
    opts.plugins.refLines = {
      lines: [
        { value: target, color: css('--ink-2'), dash: [6, 4], label: 'Target ' + target.toLocaleString('en-GB') },
        { value: average, color: css('--accent'), dash: [2, 3], label: 'Average ' + Math.round(average).toLocaleString('en-GB') }
      ]
    };

    return make('chart-fortnights', {
      type: 'bar',
      plugins: [refLines],
      data: {
        labels: rows.map(function (r) { return fmt(r.start); }),
        datasets: [{
          label: 'kcal per person per day',
          data: rows.map(function (r) { return r.kcalPerDay; }),
          backgroundColor: css('--accent'),
          borderRadius: 4,
          maxBarThickness: 28
        }]
      },
      options: opts
    });
  }

  // ---------- Price trends ----------

  // Two index lines (regular prices vs what was paid) on one scale, with a reference line at 100.
  function priceIndex(p) {
    var opts = baseOptions();
    opts.interaction = { mode: 'index', intersect: false };
    opts.scales = {
      x: axis({ grid: { display: false } }),
      y: axis({ ticks: { color: css('--muted'), callback: function (v) { return Math.round(v); } } })
    };
    opts.plugins.tooltip.callbacks = {
      label: function (c) {
        if (c.raw == null) return null;
        var diff = c.raw - 100;
        return c.dataset.label + ': ' + c.raw.toFixed(1) + ' (' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%)';
      }
    };
    opts.plugins.refLines = { lines: [{ value: 100, color: css('--axis'), dash: [4, 4], label: 'Start = 100' }] };
    var line = function (label, data, color) {
      return {
        label: label, data: data, borderColor: color, backgroundColor: color,
        borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, pointBorderColor: css('--surface'), pointBorderWidth: 2,
        tension: 0, spanGaps: true
      };
    };
    return make('chart-price-index', {
      type: 'line',
      plugins: [refLines],
      data: {
        labels: p.index.map(function (m) { return m.label; }),
        datasets: [
          line('Regular prices', p.index.map(function (m) { return m.regular; }), css('--series-1')),
          line('What you paid', p.index.map(function (m) { return m.paid; }), css('--series-2'))
        ]
      },
      options: opts
    });
  }

  function savingsByMonth(p) {
    var opts = baseOptions();
    opts.scales = {
      x: axis({ grid: { display: false } }),
      y: axis({ beginAtZero: true, ticks: { color: css('--muted'), callback: function (v) { return gbp(v, 0); } } })
    };
    opts.plugins.tooltip.callbacks = {
      label: function (c) { return gbp(c.raw) + ' saved'; },
      afterLabel: function (c) {
        var m = p.savingsByMonth[c.dataIndex];
        return m.withSavings + ' of ' + m.shops + ' shop' + (m.shops === 1 ? '' : 's') + ' had savings';
      }
    };
    return make('chart-savings', {
      type: 'bar',
      data: {
        labels: p.savingsByMonth.map(function (m) { return m.label; }),
        datasets: [{
          label: 'Savings', data: p.savingsByMonth.map(function (m) { return m.savings; }),
          backgroundColor: css('--series-1'), borderRadius: 4, maxBarThickness: 36
        }]
      },
      options: opts
    });
  }

  // One item's price history: what was paid (points, deals marked) and its regular price (stepped line).
  function itemHistory(item) {
    var fmt = function (d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }); };
    var unit = item.perKg ? '/kg' : '';
    var opts = baseOptions();
    opts.interaction = { mode: 'index', intersect: false };
    opts.scales = {
      x: axis({ grid: { display: false }, ticks: { color: css('--muted'), maxRotation: 0, autoSkipPadding: 14 } }),
      y: axis({ grace: '15%', ticks: { color: css('--muted'), callback: function (v) { return gbp(v) + unit; } } })
    };
    opts.plugins.tooltip.callbacks = {
      label: function (c) {
        var o = item.obs[c.dataIndex];
        if (c.datasetIndex === 0) return 'Regular price: ' + gbp(o.regular) + unit;
        return 'Paid: ' + gbp(o.price) + unit + (o.deal ? '  (deal, ' + Math.round(o.discount * 100) + '% off)' : '') +
          (o.qty > 1 ? '  ×' + o.qty : '');
      }
    };
    var dealColor = css('--series-2');
    var paidColor = css('--ink-2');
    return make('chart-item-history', {
      type: 'line',
      data: {
        labels: item.obs.map(function (o) { return fmt(o.date); }),
        datasets: [
          {
            label: 'Regular price', data: item.obs.map(function (o) { return o.regular; }),
            borderColor: css('--series-1'), backgroundColor: css('--series-1'), borderWidth: 2,
            stepped: 'before', pointRadius: 0, pointHoverRadius: 0
          },
          {
            label: 'Paid', data: item.obs.map(function (o) { return o.price; }),
            showLine: false,
            pointRadius: item.obs.map(function (o) { return o.deal ? 6 : 4; }),
            pointHoverRadius: 7,
            pointStyle: item.obs.map(function (o) { return o.deal ? 'triangle' : 'circle'; }),
            pointBackgroundColor: item.obs.map(function (o) { return o.deal ? dealColor : paidColor; }),
            pointBorderColor: css('--surface'), pointBorderWidth: 2
          }
        ]
      },
      options: opts
    });
  }

  // Call before drawing so fonts and colours follow the current theme.
  function setup() {
    Chart.defaults.font.family = css('--font');
    Chart.defaults.font.size = 12;
    Chart.defaults.color = css('--muted');
  }

  // Wraps a chart function so it does nothing when Chart.js failed to load (offline).
  function safe(fn) {
    return function () { return typeof Chart === 'undefined' ? null : fn.apply(null, arguments); };
  }

  App.Charts = {
    setup: setup,
    groupSpend: safe(groupSpend),
    typeSplit: safe(typeSplit),
    caloriesVsSpend: safe(caloriesVsSpend),
    monthly: safe(monthly),
    fortnightly: safe(fortnightly),
    priceIndex: safe(priceIndex),
    savingsByMonth: safe(savingsByMonth),
    itemHistory: safe(itemHistory),
    groupColor: groupColor,
    typeColor: typeColor,
    gbp: gbp,
    pct: pct
  };
})(window.App);
