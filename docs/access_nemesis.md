# Accessing Nemesis
Nemesis runs inside of a Kubernetes(k8s) cluster. k8s distributions differ in how they expose internal k8s services to the world outside of the cluster. Some expose them automatically, whereas others require you to expose them in some way. The steps below detail how to expose Nemesis's HTTP services using various k8s distributions..

## Accessing Nemesis k3s
When you deploy Nemesis on k3s, you can access Nemesis over HTTPS on port 443 on the server it's deployed on (i.e., whatever you specified in `operation.nemesisHttpServer` configuration option, `https://localhost/` by default).

If you [changed the port of the HTTP listener](setup.md#optional-change-nemesiss-listening-port), ensure the `operation.nemesisHttpServer` configuration option matches.

## Accessing Nemesis via Minikube's Endpoints
If you use Minikube, by default, services are not exposed anywhere outside of the cluster. As such, to access the services you need expose them to the outside world. This is easist to do with a port forward.

In the examples below, the following assumptions are made:
- Minikube server IP: `192.168.230.42`.
- Nemesis's [`nemesisHttpServer` option](https://github.com/SpecterOps/Nemesis/blob/main/helm/nemesis/values.yaml) is configured to be `https://192.168.230.42:7443/`

To quickly setup an SSH port forward, you can use the [minikube_port_forward.sh](https://github.com/SpecterOps/Nemesis/blob/main/scripts/minikube_port_forward.sh) script:
```bash
cd Nemesis/scripts/
./minikube_port_forward.sh 7443
```
Output:
```
Forwarding the nginx service listening on 192.168.49.2:30123 to 0.0.0.0:7443 via SSH.

  Access Nemesis at: https://HOST_IP:7443

Use 'Ctrl+C' to stop the forward.
```
You can then access Nemesis's HTTP endpoint at `https://192.168.230.42:7443`.

* **Note:** If you forgot to get the basic auth username/password when running the `quickstart` chart, you can get them by running the following:
```
export BASIC_AUTH_USER=$(kubectl get secret basic-auth -o jsonpath="{.data.username}" | base64 -d)
export BASIC_AUTH_PASSWORD=$(kubectl get secret basic-auth -o jsonpath="{.data.password}" | base64 -d)

echo "Basic Auth Username: ${BASIC_AUTH_USER}"
echo "Basic Auth Password: ${BASIC_AUTH_PASSWORD}"
``

## Manually setting up Minikube Portforward with SSH
If you do not want to use the `minikube_port_forward.sh` script, you can manually setup the port forward using steps below.

In the examples below, the following assumptions are made:
- Minikube server IP: `192.168.230.42`.
- Nemesis's [`nemesisHttpServer` option](../helm/nemesis/values.yaml) is configured to be `https://192.168.230.42:7443/`

### Step 1) Identify the private HTTPS ingress service endpoint
Minikube exposes k8s services to in a private network you can access locally on the k8s host. Run the following to list the `nginx` ingress's endpoint:
```bash
minikube service list -n kube-system
```
Example output:
```
|-------------|----------|---------------|---------------------------|
|  NAMESPACE  |   NAME   |  TARGET PORT  |            URL            |
|-------------|----------|---------------|---------------------------|
| kube-system | kube-dns | No node port  |                           |
| kube-system | traefik  | web/80        | http://192.168.49.2:32498 |
|             |          | websecure/443 | http://192.168.49.2:31863 |
|-------------|----------|---------------|---------------------------|
```
Note the value of the `https` endpoint: `http://192.168.49.2:31863`.


### Step 2) Setup the port forward to the HTTPS endpoint
There's many ways you can do this (kubectl, SSH local port forward, Socat, IP tables, etc.) some of which are detailed below.

**SSH**
Using an SSH local port forward is our preferred method right now as it's simple to setup and proven reliable.

Let's say you configure the [`nemesisHttpServer` option](https://github.com/SpecterOps/Nemesis/blob/main/helm/nemesis/values.yaml#L8) to listen on port `<HOST_IP>:7443`. Running the following command on the k8s host will expose the Minikube's endpoint externally (output in Step 1) using an SSH local port forward:
```bash
ssh -N -L <HOST_IP>:7443:192.168.49.2:30123
```



## Manually setting up Minikube Portforward with Kubectl
You can use kubectl to easily setup a port forward, but this should only be for development or quick testing as we've noticed it occasionally unexpectedly seizes up and ceases working. The following command will forward the nginx service to `0.0.0.0:7443` on the k8s host:
```bash
kubectl port-forward -n kube-system service/traefik 7443:443 --address=0.0.0.0
```

If you want `kubectl` to bind on a lower port without root, you can give it permission to so with the following:
```bash
sudo setcap CAP_NET_BIND_SERVICE=+eip $(which kubectl)
```

## Accessing Nemesis via Docker Desktop
Nemesis can run locally Docker Desktop. In that case, once Nemesis is deployed, you can access the nginx endpoint at `https://localhost/`.
