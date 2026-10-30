// Página /convite: recebe o link do e-mail do Supabase e conclui convite, senha nova ou confirmação.
// O acesso fica só na memória desta página (nunca em localStorage nem em log).
(function (root) {
  "use strict";
  var URL_BASE = "https://lafxjbnszkhnkolzjznx.supabase.co";
  var KEY = "sb_publishable_wbgzM8RJnWONPsrko__7Sw_1DRZYZrB";
  var DOWNLOAD = "https://github.com/Lucky-Level/bunny-releases/releases";

  function parseHash(hash) {
    var out = {};
    var raw = String(hash || "").replace(/^#/, "");
    if (!raw) return out;
    raw.split("&").forEach(function (pair) {
      var i = pair.indexOf("=");
      var k = decodeURIComponent((i < 0 ? pair : pair.slice(0, i)).replace(/\+/g, " "));
      var v = i < 0 ? "" : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " "));
      out[k] = v;
    });
    return out;
  }

  function jwtEmail(token) {
    try {
      var p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      var json = JSON.parse(decodeURIComponent(escape(atob(p + "===".slice((p.length + 3) % 4)))));
      return typeof json.email === "string" ? json.email : "";
    } catch (e) {
      return "";
    }
  }

  function joinNames(names) {
    if (names.length <= 1) return names[0] || "";
    return names.slice(0, -1).join(", ") + " e " + names[names.length - 1];
  }

  function api(fetchImpl, token, method, path, body) {
    return fetchImpl(URL_BASE + path, {
      method: method,
      headers: { apikey: KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(function (r) {
      return r.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = null; }
        if (!r.ok) {
          var err = new Error((data && (data.msg || data.message || data.error_description)) || "http " + r.status);
          err.status = r.status;
          err.code = data && (data.error_code || data.code);
          throw err;
        }
        return data;
      });
    });
  }

  function el(doc, tag, props, children) {
    var n = doc.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === "text") n.textContent = props[k];
      else n.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { n.appendChild(typeof c === "string" ? doc.createTextNode(c) : c); });
    return n;
  }

  function lastStep(doc) {
    var p = el(doc, "p", { class: "last" }, [
      "Abra o Bunny no seu computador e entre com o seu e-mail. Ainda não tem o app? ",
      el(doc, "a", { href: DOWNLOAD, text: "Baixe aqui" }),
      ".",
    ]);
    return p;
  }

  function render(doc, title, nodes) {
    var app = doc.getElementById("app");
    app.textContent = "";
    app.appendChild(el(doc, "h1", { text: title }));
    nodes.forEach(function (n) { app.appendChild(typeof n === "string" ? el(doc, "p", { text: n }) : n); });
  }

  function passwordForm(doc, email, submitLabel, onSubmit) {
    var form = el(doc, "form", { novalidate: "" });
    var l1 = el(doc, "label", { for: "pw1", text: "Crie sua senha (mínimo 8 caracteres)" });
    var i1 = el(doc, "input", { id: "pw1", type: "password", autocomplete: "new-password", minlength: "8", required: "" });
    var l2 = el(doc, "label", { for: "pw2", text: "Repita a senha" });
    var i2 = el(doc, "input", { id: "pw2", type: "password", autocomplete: "new-password", minlength: "8", required: "" });
    var btn = el(doc, "button", { type: "submit", text: submitLabel });
    var err = el(doc, "div", { class: "err", role: "alert" });
    [l1, i1, l2, i2, btn, err].forEach(function (n) { form.appendChild(n); });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      err.textContent = "";
      if (i1.value.length < 8) { err.textContent = "A senha precisa ter pelo menos 8 caracteres."; return; }
      if (i1.value !== i2.value) { err.textContent = "As senhas não são iguais."; return; }
      btn.disabled = true;
      onSubmit(i1.value).then(null, function (e) {
        btn.disabled = false;
        err.textContent = friendly(e);
      });
    });
    return form;
  }

  function friendly(e) {
    var m = String((e && e.message) || "");
    if (/same.*password|different from the old/i.test(m)) return "Escolha uma senha diferente da anterior.";
    if (/weak|at least|should be/i.test(m)) return "Essa senha é fraca. Use pelo menos 8 caracteres, misturando letras e números.";
    if (e && (e.status === 401 || e.status === 403)) return "O link venceu. Abra o Bunny, digite seu e-mail e toque em Reenviar e-mail.";
    return "Não deu certo agora. Tente de novo em instantes.";
  }

  function companies(list) {
    return (Array.isArray(list) ? list : []).map(function (x) { return x && x.name; }).filter(Boolean);
  }

  function showJoined(doc, email, names, verb) {
    render(doc, "Pronto!", [
      el(doc, "p", {}, [verb + " ", el(doc, "strong", { text: joinNames(names) }), ". Abra o Bunny e entre com ", el(doc, "strong", { text: email }), "."]),
      lastStep(doc),
    ]);
  }

  function lostInvites(fetchImpl, token) {
    return api(fetchImpl, token, "POST", "/rest/v1/rpc/my_lost_invites", {}).then(function (rows) {
      return Array.isArray(rows) ? rows : [];
    }, function () { return []; });
  }

  function showLost(doc, rows) {
    var first = rows[0];
    var what = first.status === "revoked" ? "foi cancelado" : "venceu";
    render(doc, "Este convite não vale mais", [
      el(doc, "p", {}, ["O convite para ", el(doc, "strong", { text: first.team_name }), " " + what + ". Peça para quem convidou enviar outro."]),
      lastStep(doc),
    ]);
  }

  function run(win, fetchImpl) {
    var doc = win.document;
    var params = new win.URLSearchParams(win.location.search);
    var tipo = params.get("tipo") || "convite";
    var h = parseHash(win.location.hash);
    // Apaga o acesso da barra de endereço o quanto antes.
    if (win.location.hash) win.history.replaceState(null, "", win.location.pathname + win.location.search);

    if (h.error || h.error_code || (!h.access_token && tipo !== "conta")) {
      render(doc, "Este link venceu ou já foi usado", [
        "Abra o Bunny, digite seu e-mail e toque em Reenviar e-mail. Se você já criou sua senha, é só entrar.",
        lastStep(doc),
      ]);
      return Promise.resolve("erro");
    }
    if (tipo === "conta") {
      render(doc, "E-mail confirmado!", ["Volte ao Bunny, digite seu e-mail e entre com a sua senha.", lastStep(doc)]);
      return Promise.resolve("conta");
    }

    var token = h.access_token;
    var email = jwtEmail(token);
    var type = h.type || "";
    var emailBox = function () {
      return el(doc, "div", { class: "mail" }, [email ? "Você está usando a conta de " + email + ". Se este não é o seu e-mail, feche a página." : "Conta do convite"]);
    };

    function setPassword(pw) {
      return api(fetchImpl, token, "PUT", "/auth/v1/user", { password: pw });
    }

    function acceptAndShow(verb, afterNames) {
      return api(fetchImpl, token, "POST", "/rest/v1/rpc/accept_my_invites", {}).then(function (list) {
        var names = companies(list);
        if (names.length) return afterNames(names);
        return lostInvites(fetchImpl, token).then(function (rows) {
          if (rows.length) return showLost(doc, rows);
          render(doc, "Tudo certo com a sua conta", [
            el(doc, "p", {}, ["Não há convite pendente para ", el(doc, "strong", { text: email || "este e-mail" }), ". Abra o Bunny e entre."]),
            lastStep(doc),
          ]);
        });
      });
    }

    if (tipo === "senha" || type === "recovery") {
      render(doc, "Crie uma senha nova", [emailBox(), passwordForm(doc, email, "Salvar senha nova", function (pw) {
        return setPassword(pw).then(function () {
          return api(fetchImpl, token, "POST", "/rest/v1/rpc/accept_my_invites", {}).then(null, function () {});
        }).then(function () {
          render(doc, "Senha trocada", ["Abra o Bunny e entre com a senha nova.", lastStep(doc)]);
        });
      })]);
      return Promise.resolve("senha");
    }

    if (type === "magiclink") {
      return acceptAndShow("Você foi adicionado a", function (names) {
        showJoined(doc, email, names, "Você foi adicionado a");
        var d = el(doc, "details", {}, [el(doc, "summary", { text: "Quero trocar minha senha" })]);
        d.appendChild(passwordForm(doc, email, "Salvar senha", function (pw) {
          return setPassword(pw).then(function () {
            render(doc, "Senha trocada", ["Abra o Bunny e entre com a senha nova.", lastStep(doc)]);
          });
        }));
        doc.getElementById("app").appendChild(d);
      }).then(function () { return "magiclink"; }, function (e) {
        render(doc, "Não deu certo agora", [friendly(e), lastStep(doc)]);
        return "falha";
      });
    }

    // signup (pessoa nova convidada)
    render(doc, "Convite para entrar no Bunny", [emailBox(), passwordForm(doc, email, "Criar senha e entrar", function (pw) {
      return setPassword(pw).then(function () {
        return acceptAndShow("Você agora faz parte de", function (names) {
          showJoined(doc, email, names, "Você agora faz parte de");
        });
      });
    })]);
    return Promise.resolve("signup");
  }

  var api_ = { parseHash: parseHash, jwtEmail: jwtEmail, joinNames: joinNames, run: run };
  if (typeof module !== "undefined" && module.exports) module.exports = api_;
  if (root && root.document && root.location && !root.__CONVITE_TEST__) {
    run(root, root.fetch.bind(root));
  }
})(typeof window !== "undefined" ? window : null);
