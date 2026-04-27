import { FastifyInstance } from 'fastify';

/**
 * Public widget served as plain JS for static lodge sites (vulcan4510.com,
 * etc.) to embed a calendar of upcoming meetings + events and accept
 * visitor bookings without any build step.
 *
 * Usage on the static site:
 *   <div id="lodgekey-calendar" data-slug="vulcan4510"></div>
 *   <script src="https://api.freemasons.app/widget/v1.js" defer></script>
 *
 * The widget calls /public/lodges/:slug/calendar to render and
 * /public/lodges/:slug/visitor-bookings to submit.
 */
export async function widgetRoutes(fastify: FastifyInstance) {
  fastify.get('/v1.js', async (request, reply) => {
    const apiBase = process.env.API_BASE_URL || 'https://api.freemasons.app';
    const js = WIDGET_JS.replace(/__API_BASE__/g, apiBase);
    return reply
      .header('Content-Type', 'application/javascript; charset=utf-8')
      .header('Cache-Control', 'public, max-age=300')
      .header('Access-Control-Allow-Origin', '*')
      .send(js);
  });
}

const WIDGET_JS = `(function() {
  var API = '__API_BASE__';
  var STYLES = [
    '.lk-cal{font-family:Georgia,"Times New Roman",serif;color:#0F2547;max-width:880px;margin:0 auto;}',
    '.lk-cal *{box-sizing:border-box;}',
    '.lk-cal h2{font-family:"Playfair Display",Georgia,serif;font-style:italic;font-size:32px;text-align:center;margin:0 0 8px;color:#0F2547;}',
    '.lk-cal h2 small{display:block;font-size:14px;color:#5C6678;font-style:normal;font-family:Inter,Arial,sans-serif;letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;}',
    '.lk-cal .lk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin:24px 0;}',
    '.lk-cal .lk-card{border:1px solid #C9A24A;background:#FFFFFF;padding:18px 20px;display:flex;flex-direction:column;gap:8px;cursor:pointer;transition:transform .12s,box-shadow .12s;}',
    '.lk-cal .lk-card:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(15,37,71,0.18);}',
    '.lk-cal .lk-tag{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#7B6A2A;font-weight:700;}',
    '.lk-cal .lk-card .lk-title{font-family:"Playfair Display",Georgia,serif;font-size:20px;font-style:italic;margin:0;}',
    '.lk-cal .lk-card .lk-meta{font-size:13px;color:#5C6678;}',
    '.lk-cal .lk-cta{margin-top:auto;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#0F2547;font-weight:700;}',
    '.lk-modal-bg{position:fixed;inset:0;background:rgba(11,26,58,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;padding:24px;}',
    '.lk-modal{background:#FFFFFF;border:1px solid #C9A24A;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;padding:32px;font-family:Georgia,serif;}',
    '.lk-modal h3{font-family:"Playfair Display",Georgia,serif;font-style:italic;font-size:26px;margin:0 0 10px;color:#0F2547;}',
    '.lk-modal label{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#5C6678;margin:12px 0 4px;}',
    '.lk-modal input,.lk-modal textarea,.lk-modal select{width:100%;border:1px solid #C9A24A;background:#FBF8F2;padding:8px 12px;font-family:Georgia,serif;font-size:14px;color:#0F2547;}',
    '.lk-modal input[type="checkbox"]{width:auto;margin-right:8px;}',
    '.lk-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}',
    '.lk-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;}',
    '.lk-btn{font-family:Inter,Arial,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:12px;padding:10px 20px;border:1px solid #C9A24A;cursor:pointer;}',
    '.lk-btn.primary{background:#0F2547;color:#FFFFFF;}',
    '.lk-btn.ghost{background:#FFFFFF;color:#0F2547;}',
    '.lk-error{color:#A6332E;font-size:13px;margin-top:8px;}',
    '.lk-ok{color:#1F6240;font-size:13px;margin-top:8px;}',
  ].join('\\n');

  function injectStyles() {
    if (document.getElementById('lk-style')) return;
    var s = document.createElement('style');
    s.id = 'lk-style';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function(k){
      if (k === 'class') n.className = attrs[k];
      else if (k === 'style') n.setAttribute('style', attrs[k]);
      else if (k.indexOf('on') === 0) n[k] = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function(c){
      if (c == null) return;
      if (typeof c === 'string') n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    });
    return n;
  }

  function openVisitorModal(slug, item, lodge) {
    injectStyles();
    var bg = el('div', { class:'lk-modal-bg' });
    var status = el('div');
    var modal = el('div', { class:'lk-modal' });
    var form = el('form');

    function submit(e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(form));
      data.dining = !!form.querySelector('[name="dining"]').checked;
      data.subscribeToEvents = !!form.querySelector('[name="subscribeToEvents"]').checked;
      data.guestCount = parseInt(data.guestCount || '0', 10);
      data.meetingId = item.id;
      status.textContent = 'Sending…';
      fetch(API + '/public/lodges/' + slug + '/visitor-bookings', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data),
      }).then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
        .then(function(res){
          if (res.ok) {
            status.className = 'lk-ok';
            status.textContent = res.j.message || 'Thank you — your booking has been logged.';
            form.querySelectorAll('input,select,textarea,button').forEach(function(x){ x.disabled = true; });
          } else {
            status.className = 'lk-error';
            status.textContent = (res.j && res.j.error) || 'Booking failed — please try again.';
          }
        }).catch(function(){
          status.className = 'lk-error';
          status.textContent = 'Network error — please try again.';
        });
    }

    form.onsubmit = submit;
    modal.appendChild(el('h3', {}, [item.title]));
    modal.appendChild(el('p', { style:'color:#5C6678;margin:0 0 14px;font-size:13px;' }, [
      fmtDate(item.date) + (item.startTime ? ' · ' + item.startTime : '') + (item.venue ? ' · ' + item.venue : ''),
    ]));
    modal.appendChild(form);

    function field(label, name, opts) {
      opts = opts || {};
      var lab = el('label', {}, [label + (opts.required ? ' *' : '')]);
      var inp = el(opts.tag || 'input', { name: name, type: opts.type || 'text', required: opts.required ? 'required' : null, placeholder: opts.placeholder || '' });
      form.appendChild(lab);
      form.appendChild(inp);
    }

    var row = el('div', { class:'lk-row' });
    var labFirst = el('label', {}, ['First name *']);
    var inpFirst = el('input', { name:'firstName', required:'required' });
    var divLeft = el('div', {}, [labFirst, inpFirst]);
    var labLast = el('label', {}, ['Last name *']);
    var inpLast = el('input', { name:'lastName', required:'required' });
    var divRight = el('div', {}, [labLast, inpLast]);
    row.appendChild(divLeft); row.appendChild(divRight);
    form.appendChild(row);

    field('Rank (e.g. W. Bro., PPJGW)', 'rank');

    var row2 = el('div', { class:'lk-row' });
    var dl1 = el('div', {}, [el('label', {}, ['Mother lodge *']), el('input', { name:'lodgeName', required:'required' })]);
    var dl2 = el('div', {}, [el('label', {}, ['Lodge number *']), el('input', { name:'lodgeNumber', required:'required' })]);
    row2.appendChild(dl1); row2.appendChild(dl2);
    form.appendChild(row2);

    field('Email *', 'email', { type:'email', required:true });
    field('Phone (optional)', 'phone', { type:'tel' });

    var row3 = el('div', { class:'lk-row' });
    var dining = el('div', {}, [
      el('label', {}, [
        el('input', { type:'checkbox', name:'dining' }),
        document.createTextNode('Joining the festive board'),
      ]),
    ]);
    var guests = el('div', {}, [el('label', {}, ['Number of guests']), el('input', { name:'guestCount', type:'number', min:'0', max:'10', value:'0' })]);
    row3.appendChild(dining); row3.appendChild(guests);
    form.appendChild(row3);

    field('Guest names (one per line)', 'guestNames', { tag:'textarea' });
    field('Dietary requirements (optional)', 'dietary');
    field('Anything else for the DC?', 'notes', { tag:'textarea' });

    form.appendChild(el('label', { style:'margin-top:14px;text-transform:none;letter-spacing:0;font-size:14px;color:#0F2547;' }, [
      el('input', { type:'checkbox', name:'subscribeToEvents' }),
      document.createTextNode('Tell me about future ' + lodge.name + ' events'),
    ]));

    var actions = el('div', { class:'lk-actions' });
    var cancelBtn = el('button', { type:'button', class:'lk-btn ghost', onclick: function(){ document.body.removeChild(bg); } }, ['Cancel']);
    var submitBtn = el('button', { type:'submit', class:'lk-btn primary' }, ['Submit booking']);
    actions.appendChild(cancelBtn); actions.appendChild(submitBtn);
    form.appendChild(actions);
    form.appendChild(status);

    bg.onclick = function(e){ if (e.target === bg) document.body.removeChild(bg); };
    bg.appendChild(modal);
    document.body.appendChild(bg);
  }

  function render(host, slug) {
    injectStyles();
    host.classList.add('lk-cal');
    host.textContent = 'Loading…';
    fetch(API + '/public/lodges/' + slug + '/calendar')
      .then(function(r){ return r.json(); })
      .then(function(data){
        host.innerHTML = '';
        host.appendChild(el('h2', {}, [
          data.lodge.name + ' No. ' + data.lodge.number,
          el('small', {}, ['Upcoming meetings & events']),
        ]));
        var grid = el('div', { class:'lk-grid' });
        var combined = [].concat(
          data.meetings.map(function(m){ return Object.assign({}, m, { kind:'MEETING' }); }),
          data.events.map(function(e){ return Object.assign({}, e, { kind:'EVENT' }); }),
        ).sort(function(a,b){ return new Date(a.date) - new Date(b.date); });

        combined.forEach(function(item){
          var card = el('div', { class:'lk-card' });
          card.appendChild(el('p', { class:'lk-tag' }, [item.kind === 'MEETING' ? 'Lodge Meeting' : 'Event']));
          card.appendChild(el('h3', { class:'lk-title' }, [item.title]));
          var meta = fmtDate(item.date);
          if (item.startTime) meta += ' · ' + item.startTime;
          if (item.venue) meta += ' · ' + item.venue;
          card.appendChild(el('p', { class:'lk-meta' }, [meta]));
          if (item.kind === 'EVENT' && item.description) {
            card.appendChild(el('p', { class:'lk-meta' }, [item.description.split('\\n')[0].slice(0, 140)]));
          }
          card.appendChild(el('p', { class:'lk-cta' }, ['Book to attend →']));
          card.onclick = function(){ openVisitorModal(slug, item, data.lodge); };
          grid.appendChild(card);
        });
        host.appendChild(grid);
      })
      .catch(function(){ host.textContent = 'Could not load lodge calendar.'; });
  }

  function init() {
    var hosts = document.querySelectorAll('[data-lodgekey-calendar]');
    hosts.forEach(function(h){ render(h, h.getAttribute('data-lodgekey-calendar') || h.getAttribute('data-slug')); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();`;
