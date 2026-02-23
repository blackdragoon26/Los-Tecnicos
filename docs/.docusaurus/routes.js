import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
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
