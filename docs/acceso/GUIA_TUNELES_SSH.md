# Guía de túneles SSH — MachineLove_spaceapps

Tus amigos se conectan a **tu cuenta (`equimanthorn`)** con su propia llave, pero **solo pueden abrir túneles**: no tienen terminal ni pueden ver tus archivos. Así acceden a los servicios del proyecto (servidor web, API, base de datos, Jupyter, etc.) como si corrieran en su propia computadora.

## Orden de pasos

| Paso | Quién | Qué |
|------|-------|-----|
| 1 | `equimanthorn` | Habilitar SSH, firewall y probar |
| 2 | Amigos | Generar llave y enviar la `.pub` (en paralelo al paso 1) |
| 3 | `equimanthorn` | Agregar sus llaves **restringidas a túneles** |
| 4 | Amigos | Abrir el túnel y usar el servicio |

---

## Paso 1 — Configurar tu máquina (`equimanthorn`, Arch Linux)

### 1.1 Habilitar SSH y abrir el firewall
```bash
sudo systemctl enable --now sshd
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
```

### 1.2 Verificar que se permite el reenvío de puertos
Arch lo permite por defecto (`AllowTcpForwarding yes`). Basta con confirmar que no está desactivado en la configuración:
```bash
grep -ri "AllowTcpForwarding\|PasswordAuthentication" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/
```
- Si `AllowTcpForwarding` solo aparece comentado (`#AllowTcpForwarding ...`), está **permitido**. ✅
- `PasswordAuthentication no` debe aparecer **sin** `#`. ✅

> [!NOTE]
> `sudo sshd -T` también sirve, pero si no imprime nada, ejecútalo sin `grep` (`sudo sshd -T 2>&1 | head`) para ver el error.

### 1.3 Red: un amigo por Wi-Fi y otro por cable directo

| Amigo | Conexión | IP del anfitrión que usa |
|-------|----------|--------------------------|
| Amigo Wi-Fi | Mismo router Wi-Fi | `10.61.5.140` |
| Amigo cable | Cable directo PC a PC | `10.0.0.1` |

**Anfitrión — activar el cable directo** (perfil `Direct-Cable`, IP fija `10.0.0.1`, no afecta al Wi-Fi):
```bash
nmcli connection up Direct-Cable
ip -4 -br addr show enp7s0   # debe mostrar 10.0.0.1/24
```
Para que se active solo al conectar el cable:
```bash
nmcli connection modify Direct-Cable connection.autoconnect yes
```

Asegúrate de que el firewall permita SSH en la interfaz del cable:
```bash
sudo firewall-cmd --get-zone-of-interface=enp7s0
sudo firewall-cmd --zone=$(sudo firewall-cmd --get-zone-of-interface=enp7s0) --add-service=ssh --permanent
sudo firewall-cmd --reload
```

**Amigo por cable — poner IP fija `10.0.0.2`** (máscara `255.255.255.0`, sin puerta de enlace):

- **Linux (NetworkManager):**
  ```bash
  nmcli connection add type ethernet ifname <interfaz> con-name Direct-Cable \
    ipv4.method manual ipv4.addresses 10.0.0.2/24 ipv4.never-default yes
  nmcli connection up Direct-Cable
  ```
- **Windows:** Configuración → Red → Ethernet → Editar asignación de IP → Manual → IPv4:
  IP `10.0.0.2`, máscara `255.255.255.0`, puerta de enlace **vacía**.
- **macOS:** Ajustes → Red → Ethernet → Detalles → TCP/IP → Manual:
  IP `10.0.0.2`, máscara `255.255.255.0`, router **vacío**.

Probar desde el amigo por cable:
```bash
ping 10.0.0.1
```

> [!NOTE]
> Al dejar la puerta de enlace vacía, el amigo por cable sigue usando su Wi-Fi para internet y el cable solo para llegar a tu PC.

### 1.4 Probar
```bash
# Si no tienes llave propia:
ssh-keygen -t ed25519
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys

ssh equimanthorn@localhost
```

---

## Paso 2 — Amigos: generar y enviar su llave

```bash
ssh-keygen -t ed25519 -C "tu_nombre"
```
Presiona **Enter** en todo. Luego muestra la llave **pública** y envíasela al anfitrión:

**Linux / macOS / Git Bash:**
```bash
cat ~/.ssh/id_ed25519.pub
```
**Windows PowerShell:**
```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

> [!IMPORTANT]
> Envía solo el archivo `.pub`. La llave privada (`id_ed25519`) nunca se comparte.

---

## Paso 3 — Agregar las llaves restringidas (`equimanthorn`)

Edita tu archivo de llaves:
```bash
nano ~/.ssh/authorized_keys
```

Agrega **una línea por amigo** con este formato (todo en una sola línea):
```text
restrict,port-forwarding,permitopen="localhost:8000",permitopen="localhost:8001",permitopen="localhost:5432",command="/usr/bin/false" ssh-ed25519 AAAA...llave_del_amigo... nombre_amigo
```

Qué hace cada opción:

| Opción | Efecto |
|--------|--------|
| `restrict` | Bloquea todo por defecto (terminal, X11, agente, etc.) |
| `port-forwarding` | Vuelve a permitir **solo** los túneles |
| `permitopen="localhost:PUERTO"` | Limita a qué puertos pueden llegar. Pon uno por cada servicio del proyecto |
| `command="/usr/bin/false"` | Si intentan abrir una terminal, se cierra al instante |

> [!WARNING]
> Sin `restrict` y `command=...`, tu amigo tendría **shell completa como tú** (acceso a todos tus archivos). Nunca pegues su llave sin esas opciones.

> [!TIP]
> Si quieres dejarles usar cualquier puerto, quita las opciones `permitopen=...`. Es menos seguro, pero más flexible mientras el proyecto cambia.

Para quitarle el acceso a alguien, borra su línea.

---

## Paso 4 — Amigos: abrir el túnel

Con el servicio del proyecto corriendo en la máquina del anfitrión (ej. en el puerto `8000`):

```bash
ssh -N -L 8000:localhost:8000 equimanthorn@<IP>
```

- `-N` → no abre terminal, solo el túnel (es **obligatorio**: sin él la conexión se cierra).
- `-L 8000:localhost:8000` → tu puerto local `8000` apunta al puerto `8000` del anfitrión.

Deja esa terminal abierta y entra en tu navegador a **http://localhost:8000**.

**Varios servicios a la vez:**
```bash
ssh -N -L 8000:localhost:8000 -L 5432:localhost:5432 equimanthorn@<IP>
```

### (Opcional) Atajo en `~/.ssh/config`
```sshconfig
Host machinelove
    HostName <IP>
    User equimanthorn
    IdentityFile ~/.ssh/id_ed25519
    LocalForward 8000 localhost:8000
    LocalForward 5432 localhost:5432
    ServerAliveInterval 30
```
Y solo ejecutas:
```bash
ssh -N machinelove
```

---

## Problemas comunes

| Error | Causa probable | Solución |
|-------|----------------|----------|
| `Connection refused` (al conectar) | `sshd` apagado | `sudo systemctl start sshd` |
| `Connection timed out` | Firewall, IP equivocada o cable no activo | Paso 1.1 / revisar IP en paso 1.3 / `ping <IP>` |
| `Permission denied (publickey)` | Llave mal pegada | Revisar que la línea esté completa en `authorized_keys` |
| La conexión se cierra al instante | Falta `-N` | Usar `ssh -N ...` |
| `open failed: administratively prohibited` | Puerto no está en `permitopen` | Agregar el puerto en su línea de `authorized_keys` |
| `channel ... connect failed: Connection refused` | El servicio del proyecto no está corriendo | Iniciar el servicio en el anfitrión |
| `bind: Address already in use` | El puerto local ya está ocupado en la PC del amigo | Usar otro local: `-L 9000:localhost:8000` |
