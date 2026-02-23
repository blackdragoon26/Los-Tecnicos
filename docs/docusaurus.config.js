// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const simplePlantUML = require("@akebifiky/remark-simple-plantuml");
const { themes } = require("prism-react-renderer");
const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Stelltron",
  tagline: "Peer-to-peer solar energy trading on Stellar",
  favicon: "img/favicon.ico",

  url: "https://los-tecnicos.vercel.app",
  baseUrl: "/",

  organizationName: "blackdragoon26",
  projectName: "Los-Tecnicos",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          routeBasePath: "/",
          remarkPlugins: [simplePlantUML],
          editUrl:
            "https://github.com/blackdragoon26/Los-Tecnicos/tree/main/docs/",
        },
        blog: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/stelltron-social.png",
      colorMode: {
        defaultMode: "dark",
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: "Stelltron",
        logo: {
          alt: "Stelltron Logo",
          src: "img/logo.png",
          srcDark: "img/logo.png",
          width: 32,
          height: 32,
        },
        items: [
          {
            type: "docSidebar",
            sidebarId: "docs",
            position: "left",
            label: "Docs",
          },
          {
            href: "https://github.com/blackdragoon26/Los-Tecnicos",
            label: "GitHub",
            position: "right",
          },
          {
            href: "https://los-tecnicos-frontend.vercel.app",
            label: "Live App",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              { label: "Overview", to: "/" },
              { label: "Getting Started", to: "/getting-started/quickstart" },
              { label: "API Reference", to: "/api/api-overview" },
            ],
          },
          {
            title: "Product",
            items: [
              {
                label: "Live App",
                href: "https://los-tecnicos-frontend.vercel.app",
              },
              {
                label: "Backend API",
                href: "https://los-tecnicos-backend.onrender.com",
              },
            ],
          },
          {
            title: "Community",
            items: [
              {
                label: "GitHub",
                href: "https://github.com/blackdragoon26/Los-Tecnicos",
              },
              {
                label: "Stellar",
                href: "https://stellar.org",
              },
            ],
          },
        ],
        copyright: `Built for Stellar Build-A-Thon by Los Técnicos. ${new Date().getFullYear()}`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ["rust", "go", "bash", "json"],
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 3,
      },
    }),
};

module.exports = config;
