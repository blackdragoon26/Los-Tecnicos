import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '5ff'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '5ba'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'a2b'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', 'c3c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', '156'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '88c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '000'),
    exact: true
  },
  {
    path: '/',
    component: ComponentCreator('/', '105'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/', 'c8a'),
        routes: [
          {
            path: '/',
            component: ComponentCreator('/', '097'),
            routes: [
              {
                path: '/algorithms/dynamic-pricing',
                component: ComponentCreator('/algorithms/dynamic-pricing', '6cc'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/algorithms/matching-engine',
                component: ComponentCreator('/algorithms/matching-engine', '566'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/algorithms/zero-knowledge',
                component: ComponentCreator('/algorithms/zero-knowledge', 'd24'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/api/api-overview',
                component: ComponentCreator('/api/api-overview', 'd5b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/architecture/business-flow',
                component: ComponentCreator('/architecture/business-flow', 'a03'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/architecture/system-overview',
                component: ComponentCreator('/architecture/system-overview', 'aec'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/contracts/contracts-overview',
                component: ComponentCreator('/contracts/contracts-overview', '8fe'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/defi/defi-overview',
                component: ComponentCreator('/defi/defi-overview', '600'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/getting-started/quickstart',
                component: ComponentCreator('/getting-started/quickstart', 'c60'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/iot/iot-overview',
                component: ComponentCreator('/iot/iot-overview', 'd84'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/',
                component: ComponentCreator('/', '7da'),
                exact: true,
                sidebar: "docs"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
