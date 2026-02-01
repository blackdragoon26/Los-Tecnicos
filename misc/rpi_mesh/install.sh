#!/bin/bash
# install.sh - Automated Raspberry Pi setup

echo "🔋 Los Tecnicos - Mesh Node Installer 🔋"

# Update system
echo "Updating system..."
sudo apt update && sudo apt upgrade -y

# Install dependencies
echo "Installing dependencies..."
sudo apt install -y python3 python3-pip batman-adv dnsmasq hostapd

# Enable batman-adv
echo "Configuring batman-adv..."
sudo modprobe batman-adv
echo "batman-adv" | sudo tee -a /etc/modules

# Install Python packages
echo "Installing Python requirements..."
pip3 install asyncio paho-mqtt stellar-sdk flask

# Setup Service
echo "Creating systemd service..."
cat << EOF | sudo tee /etc/systemd/system/energy-node.service
[Unit]
Description=Los Tecnicos Mesh Node
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/energy-mesh-node/main.py
WorkingDirectory=/home/pi/energy-mesh-node
StandardOutput=inherit
StandardError=inherit
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
EOF

# Reload and Enable
sudo systemctl daemon-reload
sudo systemctl enable energy-node
# sudo systemctl start energy-node

echo "✅ Installation Complete! Please reboot."
