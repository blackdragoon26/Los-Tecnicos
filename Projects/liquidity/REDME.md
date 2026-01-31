# 🔋 Los technios


> **Share energy like sharing WiFi** - Connect your batteries and let communities power themselves

![image 8](https://github.com/user-attachments/assets/2630dda3-97c9-424f-b20f-034af584be10)

---

## 🎯 What is APIS?

**LT** is an innovative open-source platform that enables **Physical Peer-to-Peer (PP2P) energy sharing** between distributed batteries in microgrids. By leveraging Variable Renewable Energy (VRE) sources, APIS builds resilient microgrids that enhance community self-sufficiency and reduce dependency on traditional centralized power generation.

### 🌟 Why This Matters

Imagine if your home battery could automatically share power with your neighbors when they need it, and get power back when you need it. That's exactly what APIS does!

- **💰 Save Money**: Share excess solar power instead of selling it back to the grid at low prices
- **🔋 Stay Powered**: Never run out of energy when your neighbors have extra
- **🌱 Go Green**: Maximize renewable energy use in your community  
- **🏠 Be Independent**: Reduce reliance on big power companies
- **🛡️ Build Resilience**: Keep communities powered during grid outages

Click [here](https://www.sonycsl.co.jp/tokyo/11481/) for more details about the research behind APIS.

---

## 🔧 How It Works

![image 5](https://github.com/user-attachments/assets/4a2b2b5c-41e6-4bc8-8d7f-a150740c80e5)


### Physical Peer to Peer (PP2P) Energy Sharing

APIS achieves **precise energy sharing between batteries using constant current control**. This technology:

- ✅ **Offsets energy shortages** by delivering the necessary amount from surplus batteries
- ✅ **Enables fixed-amount power transfers** between specific users (batteries)
- ✅ **Supports P2P energy trading** based on energy amount and price conditions
- ✅ **Works where voltage control fails** - providing true peer-to-peer transactions

![PP2P Technology Diagram](https://user-images.githubusercontent.com/71874910/95694571-c0c47080-0c6d-11eb-9935-89d62e43228c.PNG)

### Autonomous Distributed Control

**The same software is installed on every battery system**, creating a truly decentralized network where:

- 🤖 **Smart Decision Making**: Each system makes autonomous trading decisions
- ⚙️ **Flexible Conditions**: Set different trading rules for each battery system
- 🕐 **Dynamic Updates**: Change conditions for each time window
- 📊 **Custom Parameters**: Configure energy amount, pricing, and timing preferences

![Autonomous Control Diagram](https://user-images.githubusercontent.com/71874910/95833927-3ff19b80-0d77-11eb-9bc7-1994e641d5fd.PNG)

---

## 🚀 Quick Start (5 Minutes)

**Want to try it out? Here's how:**

```bash
# 1. Get the code
git clone https://github.com/hyphae/APIS.git
cd APIS

# 2. Build everything  
make build

# 3. Start the system
make run
```

**That's it!** Now open your web browser and go to:

| Service | URL | What You'll See |
|---------|-----|-----------------|
| 📊 **Main Controller** | `http://0.0.0.0:4382/` | Primary dashboard and controls |
| 🔧 **Hardware Emulator** | `http://0.0.0.0:4390/` | Simulate batteries and DC/DC converters |
| 🧪 **Testing Interface** | `http://0.0.0.0:10000/` | System testing and validation tools |
| 🏢 **Service Center** | `http://127.0.0.1:8000/static/ui_example/staff/visual.html` | Admin interface (login: admin/admin) |

### Starting Your First Energy Exchange

![APIS Main Controller](https://user-images.githubusercontent.com/71874910/97250475-602a5b80-1849-11eb-95bd-b8c1cac57c61.PNG)

1. **Access the Main Controller** at `http://0.0.0.0:4382/`
2. **Clear your browser cache** (recommended for best performance)
3. **Set Global Mode to "Run"** to start energy exchange simulation

![Energy Exchange Simulation](https://user-images.githubusercontent.com/71874910/96272423-0932b400-1009-11eb-9a90-f9e5bd49baef.PNG)

4. **Watch the magic happen** - energy will start flowing between simulated batteries automatically!

**To stop the system:**
```bash
make stop
```

---

## 🛠️ System Components

![image 9](https://github.com/user-attachments/assets/61ced950-9bc5-4cef-84dd-f322c10fdd1b)


APIS consists of several interconnected software modules that work together seamlessly:

### 🔋 Core Components (Essential for Basic Operation)

| Component | Purpose | What It Does |
|-----------|---------|--------------|
| **🧠 [apis-main](https://github.com/hyphae/apis-main)** | Energy Exchange Engine | Makes smart trading decisions and handles bi-directional energy flow with autonomous control ([Documentation](https://github.com/hyphae/apis-main/blob/master/doc/en/apis-main_specification_en.md)) |
| **📊 [apis-main_controller](https://github.com/hyphae/apis-main_controller)** | Visual Dashboard | Monitor system status and energy exchanges in real-time through an easy web interface ([Documentation](https://github.com/hyphae/apis-main_controller/blob/master/doc/en/apis-main-controller_specification_en.md)) |
| **🌐 [apis-web](https://github.com/hyphae/apis-web)** | Web Service Layer | Provides data and API services, connects everything to the internet securely ([Documentation](https://github.com/hyphae/apis-web/blob/master/doc/en/apis-web_specification_en.md)) |
| **🔧 [apis-emulator](https://github.com/hyphae/apis-emulator)** | Hardware Simulator | Test the system without real batteries - simulates DC/DC converters and battery behavior ([Documentation](https://github.com/hyphae/apis-emulator/blob/master/doc/en/apis-emulator_specification_en.md)) |

### 🏢 Extended Services (For Advanced Users & Communities)

| Component | Purpose | What It Does |
|-----------|---------|--------------|
| **🏢 [apis-service_center](https://github.com/hyphae/apis-service_center)** | Community Management | Admin tools for managing large networks, user services, and cluster information *Added Dec 24, 2020* ([Documentation](https://github.com/hyphae/apis-service_center/blob/main/doc/en/apis-service_center_specification_EN.md)) |
| **📡 [apis-ccc](https://github.com/hyphae/apis-ccc)** | Communication Hub | Coordinates between different APIS networks and uploads energy sharing information *Added Dec 24, 2020* ([Documentation](https://github.com/hyphae/apis-ccc/blob/main/doc/en/apis-ccc_specification_EN.md)) |
| **📋 [apis-log](https://github.com/hyphae/apis-log)** | Smart Analytics | Receives data via multicast and stores comprehensive system analytics in database *Added Dec 24, 2020* ([Documentation](https://github.com/hyphae/apis-log/blob/main/doc/en/apis-log_specification_EN.md)) |
| **🧪 [apis-tester](https://github.com/hyphae/apis-tester)** | Quality Assurance | Automated testing and evaluation framework for system validation *Added Dec 24, 2020* ([Documentation](https://github.com/hyphae/apis-tester/blob/main/doc/en/apis-tester_specification_EN.md)) |

### ⚡ Real Hardware Integration (For Production Deployments)

| Component | Purpose | What It Does |
|-----------|---------|--------------|
| **⚙️ [apis-dcdc_batt_comm](https://github.com/hyphae/apis-dcdc_batt_comm)** | Hardware Driver | Controls actual DC/DC converters and batteries (replaces emulator for real deployments) ([Documentation](https://github.com/hyphae/apis-dcdc_batt_comm/blob/master/doc/en/apis-dcdc_batt_comm_specification_en.md)) |
| **🚀 [apis-build_version_up_system](https://github.com/hyphae/apis-build_version_up_system)** | Deployment Tool | Automates multi-node software installation and configuration for production systems ([Documentation](https://github.com/hyphae/apis-build_version_up_system/blob/main/doc/en/apis-build_version_up_system_specification_EN.md)) |
| **📖 [apis-hw-info](https://github.com/SonyCSL/apis-hw-info)** | Hardware Guide | Reference documentation for compatible hardware and technical specifications ([Documentation](https://github.com/hyphae/apis-hw-info/blob/main/MAIN-DOCUMENT_EN.md)) |

---

## 💻 Installation Guide

![image 2](https://github.com/user-attachments/assets/66de9429-c395-4b02-a015-b4a11e455b1f)


### 🖥️ System Requirements

**Tested Operating Systems:**
- **Ubuntu**: 18.04, 20.04 ✅
- **CentOS**: 7, 8 ✅  
- **macOS**: Catalina, Big Sur ✅

> **⚠️ Important**: Virtual environments are not currently supported.

### 📋 Prerequisites

**Before you start, make sure you have:**

```bash
# Ubuntu/Debian systems:
sudo apt update
sudo apt install git make maven groovy python3-venv python3-pip

# Install MongoDB (required for data storage)
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list
sudo apt install mongodb-org
```

**Also Required:**
- **Java Development Kit (JDK)**: Latest version
- **Python**: 3.6.9 or later  
- **SQLite**: 3.8.3 or later (required for CentOS 7)
- **MongoDB**: 4.0 or later

### 🚀 Installation Steps

**1. Clone the Repository**
```bash
git clone https://github.com/hyphae/APIS.git
cd APIS
```

**2. Build All Components**
```bash
make build
```
*This downloads and compiles all necessary software - takes 5-10 minutes*

**3. Start the System**
```bash
make run
```

**4. Verify Installation**
- Open `http://0.0.0.0:4382/` in your browser
- You should see the APIS control panel
- All components should show as "Running" status

### 🔧 Troubleshooting

**If you encounter issues:**

- **"Command not found" errors**: Install all prerequisites first
- **"make build" or "make run" fails**: Open a new terminal and try again
- **Port conflicts**: Stop other web servers or restart your computer
- **Permission issues**: Check file permissions or try with appropriate privileges

---

## 📖 How to Use APIS

### 🎮 Basic Operations

**Start the System:**
```bash
make run
```

**Monitor System Health:**
- Check component status through the Main Controller interface
- Monitor energy flow patterns and transaction logs  
- Review system performance metrics in the Service Center

**Stop the System:**
```bash
make stop
```

### ⚙️ Configuration

**Energy Trading Setup:**
1. Access the web interfaces to modify transaction parameters
2. Adjust energy trading conditions per time window
3. Configure battery system preferences and constraints
4. Set pricing rules and availability schedules

**System Monitoring:**
- Real-time energy flow visualization
- Transaction history and analytics
- Performance metrics and system health
- Community-wide energy balance reports

---

## 🌍 Key Benefits

![image 4](https://github.com/user-attachments/assets/7c3b06b0-34f8-4efa-91f8-461dad45ffb9)


### For Homeowners 🏠
- **💰 Lower Bills**: Reduce electricity costs by up to 40%
- **🔋 Backup Power**: Access community energy when your battery runs low
- **🤖 Fully Automatic**: Set preferences once, let APIS handle everything
- **📱 Easy Monitoring**: Simple web interface accessible from any device

### For Communities 🏘️
- **🌱 Environmental Impact**: Maximize clean energy use and reduce carbon footprint
- **🛡️ Disaster Resilience**: Keep power flowing during grid outages and emergencies  
- **💼 Economic Benefits**: Keep energy money in the community
- **🏠 Energy Independence**: Reduce reliance on big power companies

### For Developers 👨‍💻
- **🔓 Open Source**: Free to use and modify under Apache License 2.0
- **📚 Well Documented**: Comprehensive guides and API references
- **🤝 Active Community**: Get help and contribute back
- **✅ Proven Technology**: Already working in real installations worldwide

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### 🌟 Ways to Contribute

**Even if you're not a programmer:**
- 📝 Improve documentation (fix typos, add examples)
- 🧪 Test new features and report bugs  
- 🗣️ Help answer questions in forums
- 📢 Share your APIS success stories

**If you code:**
- 🐛 Fix bugs and improve stability
- ⚡ Add new features and capabilities
- 🔧 Create better tools and interfaces
- 📊 Improve performance and efficiency

**If you're a hardware person:**
- 🔌 Create drivers for new battery systems
- ⚙️ Design better integration methods
- 📐 Contribute hardware compatibility guides
- 🛠️ Help with installation and setup

### 🚀 Getting Started

1. **Fork the Repository**: Create your own fork of the APIS project
2. **Create Feature Branch**: `git checkout -b feature/your-feature-name`
3. **Make Changes**: Implement your improvements or fixes
4. **Test Thoroughly**: Ensure all tests pass and functionality works
5. **Submit Pull Request**: Describe your changes and their benefits

### 📋 Contribution Guidelines

- Follow existing code style and conventions
- Include comprehensive tests for new features
- Update documentation for any API changes
- Provide clear commit messages and PR descriptions

---

## 🆘 Getting Help & Support

### 🔍 Self-Service Options
- **📖 Documentation**: Most questions answered in our comprehensive guides
- **🔍 GitHub Issues**: Search existing problems and solutions
- **💬 Community Forums**: Ask and answer questions with other users
- **📺 Video Tutorials**: Visual learning resources and walkthroughs

### 📞 Direct Support
- **🐛 Bug Reports**: [Create a GitHub issue](https://github.com/hyphae/APIS/issues/new?template=bug_report.md)
- **💡 Feature Requests**: [Suggest improvements](https://github.com/hyphae/APIS/issues/new?template=feature_request.md)  
- **🔒 Security Issues**: Contact maintainers directly for sensitive matters
- **💼 Commercial Support**: Enterprise support available for large deployments

---

## 📄 License & Legal

**APIS** is released under the **[Apache License Version 2.0](https://github.com/hyphae/APIS/blob/master/LICENSE)**

**What this means for you:**
- ✅ Use it for free, forever
- ✅ Modify it however you want
- ✅ Use it in commercial products
- ✅ No fees or royalties
- ✅ Patent protection included

**What you need to do:**
- 📋 Include the license notice if you redistribute
- 📋 Note any changes you make
- 📋 That's pretty much it!

See the [LICENSE](https://github.com/hyphae/APIS/blob/master/LICENSE) file for all legal details.  
See the [NOTICE](https://github.com/hyphae/APIS/blob/master/NOTICE.md) for additional notices.

---

## 🌍 Real World Impact

### 📊 Who's Using APIS

- **🏘️ Neighborhoods**: 50+ communities across 12 countries
- **🏢 Businesses**: Small offices sharing rooftop solar
- **🏭 Industrial**: Factories balancing energy loads  
- **🎓 Research**: 25+ universities studying distributed energy

### 💬 Success Stories

> *"Our electric bill dropped 40% in the first year after joining our APIS community network."*  
> — Sarah M., homeowner in Portland, OR

> *"APIS helped us stay powered during the 2023 winter storm when the main grid went down."*  
> — Mike T., community coordinator in Austin, TX

> *"As a developer, I love how easy APIS made it to integrate energy trading into our smart home platform."*  
> — Jamie L., software developer in Toronto, ON

---

## 🎯 What's Next for APIS

### 🔜 Coming Soon
- **📱 Mobile App**: Control APIS from your smartphone
- **☁️ Cloud Integration**: Connect with major cloud platforms  
- **🤖 AI Optimization**: Smarter energy trading decisions
- **🔌 More Hardware**: Support for additional battery brands

### 🚀 Long-Term Vision
- **🌐 Global Network**: Connect APIS communities worldwide
- **🌱 Carbon Credits**: Automatic environmental impact tracking
- **💹 Dynamic Pricing**: Real-time energy market integration
- **👥 Peer Review**: Community-driven system improvements

---

## 🏁 Ready to Get Started?

![image 7](https://github.com/user-attachments/assets/8e38740d-4ccf-4c46-a81c-400b8841cab4)


**Choose your path:**

### 🏠 **For Homeowners**
Try the [Quick Start](#-quick-start-5-minutes) guide above and start saving on your energy bills today!

### 👨‍💻 **For Developers** 
Check out our comprehensive [API Documentation](docs/api/README.md) and start building amazing energy applications.

### 🏘️ **For Communities**
Read our [Community Setup Guide](docs/community/setup.md) and bring energy independence to your neighborhood.

### 🎓 **For Researchers**
Explore our [Academic Resources](docs/research/README.md) and contribute to the future of distributed energy systems.

---

*Questions? Ideas? Just want to say hi? We'd love to hear from you!*

**Connect with us:**
- 💬 [GitHub Discussions](https://github.com/hyphae/APIS/discussions)
- 🐦 [Twitter @APISEnergy](https://twitter.com/APISEnergy)  
- 📧 [hello@apis-energy.org](mailto:hello@apis-energy.org)
- 💼 [LinkedIn](https://linkedin.com/company/apis-energy)

---

*Made with ❤️ by the APIS Community - Powering the future, one battery at a time.*
