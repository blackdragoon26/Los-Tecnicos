// @ts-check
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'Getting Started',
      items: ['getting-started/quickstart'],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/system-overview',
        'architecture/business-flow',
        'architecture/digital-twin',
        'architecture/wallet-and-trades',
      ],
    },
    {
      type: 'category',
      label: 'Algorithms',
      items: [
        'algorithms/dynamic-pricing',
        'algorithms/matching-engine',
        'algorithms/zero-knowledge',
      ],
    },
    {
      type: 'category',
      label: 'IoT Layer',
      items: ['iot/iot-overview'],
    },
    {
      type: 'category',
      label: 'Smart Contracts',
      items: ['contracts/contracts-overview'],
    },
    {
      type: 'category',
      label: 'Experimental Labs',
      items: ['defi/defi-overview'],
    },
    {
      type: 'category',
      label: 'Company',
      items: ['company/investors'],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: ['api/api-overview'],
    },
  ],
};

module.exports = sidebars;
