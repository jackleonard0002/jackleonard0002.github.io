(function () {
    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;");
    }

    function getNavLinks(currentPage) {
        const page = String(currentPage || "").toLowerCase();
        const activePage = page === "product" ? "shop" : page;
        const links = [
            { key: "home", href: "index.html", label: "Home" },
            { key: "shop", href: "shop.html", label: "Shop" },
            { key: "about", href: "about.html", label: "About" },
            { key: "contact", href: "contact.html", label: "Contact" },
            { key: "admin", href: "admin.html", label: "Admin Dashboard", hidden: true, className: "admin-link" }
        ];

        return links.map(function (link) {
            const classes = [];
            if (link.className) {
                classes.push(link.className);
            }
            if (activePage === link.key) {
                classes.push("active");
            }

            const classAttr = classes.length ? ' class="' + classes.join(" ") + '"' : "";
            const hiddenAttr = link.hidden ? " hidden" : "";
            return '<a' + classAttr + ' href="' + link.href + '"' + hiddenAttr + '>' + link.label + "</a>";
        }).join("\n          ");
    }

    function renderHeader(currentPage) {
        return [
            '<header class="site-header">',
            '  <div class="container nav-wrap">',
            '    <a class="brand" href="index.html" aria-label="Whimsical Wands home"><img class="brand-logo" src="assets/images/whimiscal-wands-lgog.png" alt="Whimsical Wands" /></a>',
            '    <button class="menu-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Open navigation menu">Menu</button>',
            '    <nav id="site-nav" class="site-nav" aria-label="Main navigation">',
            '      <div class="nav-utility">',
            '        <div class="nav-account-row">',
            '          <div class="auth-controls" aria-live="polite">',
            '            <a class="auth-btn sign-in-link" href="signin.html">Sign in</a>',
            '            <div id="user-chip" class="user-chip" hidden>',
            '              <img id="user-avatar" class="user-avatar" alt="Signed in user avatar" />',
            '              <span id="user-name"></span>',
            '            </div>',
            '            <button id="google-logout-button" class="auth-btn auth-btn-secondary" type="button" hidden>Sign out</button>',
            '          </div>',
            '        </div>',
            '        <div class="nav-tools-row">',
            '          <button id="cart-button" class="cart-pill" aria-label="Shopping cart">',
            '            Cart <span id="cart-count" aria-live="polite">0</span>',
            '          </button>',
            '        </div>',
            '      </div>',
            '      <div class="nav-menu-links">',
            '          ' + getNavLinks(currentPage),
            '      </div>',
            '    </nav>',
            '  </div>',
            '</header>'
        ].join("\n");
    }

    function renderFooter(note) {
        const safeNote = escapeHtml(note);
        return [
            '<footer class="site-footer">',
            '  <div class="container footer-grid">',
            '    <p>&copy; 2026 Whimsical Wands. All rights reserved.</p>',
            '    <p>' + safeNote + '</p>',
            '  </div>',
            '</footer>'
        ].join("\n");
    }

    function initSharedLayout() {
        const body = document.body;
        if (!body) {
            return;
        }

        const currentPage = body.dataset.page || "";
        const footerNote = body.dataset.footerNote || "Built from imagination and careful craft.";

        const headerMount = document.querySelector("[data-site-header]");
        if (headerMount) {
            headerMount.outerHTML = renderHeader(currentPage);
        }

        const footerMount = document.querySelector("[data-site-footer]");
        if (footerMount) {
            footerMount.outerHTML = renderFooter(footerNote);
        }

        window.dispatchEvent(new CustomEvent("ww-layout-ready"));
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initSharedLayout, { once: true });
    } else {
        initSharedLayout();
    }
})();
