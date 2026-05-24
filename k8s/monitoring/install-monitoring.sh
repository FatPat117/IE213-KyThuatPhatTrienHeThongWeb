#!/bin/bash
# Script to install PLG (Prometheus, Grafana, Loki) stack using Helm on K3s

# Export Kubeconfig for K3s if available
if [ -f "/etc/rancher/k3s/k3s.yaml" ]; then
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
fi


# 1. Install Helm if not present
if ! command -v helm &> /dev/null
then
    curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
    chmod 700 get_helm.sh
    ./get_helm.sh
fi

# 2. Add Prometheus Community Repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# 3. Create namespace
kubectl create namespace monitoring

# 4. Install Prometheus
echo "Installing Prometheus..."
helm install prometheus prometheus-community/prometheus --namespace monitoring --set server.persistentVolume.enabled=false

# 5. Install Loki & Promtail (for logs)
echo "Installing Loki..."
helm install loki grafana/loki-stack --namespace monitoring --set grafana.enabled=false,prometheus.enabled=false,prometheus.alertmanager.persistentVolume.enabled=false,prometheus.server.persistentVolume.enabled=false

# 6. Install Grafana
echo "Installing Grafana..."
helm install grafana grafana/grafana --namespace monitoring --set persistence.enabled=false --set adminPassword=admin

echo "========================================="
echo "Monitoring Stack Installed Successfully!"
echo "Grafana User: admin"
echo "Grafana Password: admin"
echo "To access Grafana, you can port-forward:"
echo "kubectl port-forward svc/grafana 8080:80 -n monitoring"
echo "========================================="
