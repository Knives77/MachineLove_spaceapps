#!/usr/bin/env bash
# Acceso del equipo MachineLove por SSH con cuentas propias (esquema de docs/TOPOLOGIA.md y docs/acceso/).
#
#   sudo scripts/setup_amigos.sh                 # crea/actualiza todo (idempotente)
#   sudo AMIGOS="kalozano lar otro" scripts/setup_amigos.sh
#   sudo scripts/setup_amigos.sh --undo          # quita montaje, ACL y regla de sshd (no borra cuentas)
#
# Llaves públicas: una por persona en $KEYS_DIR/<usuario>.pub
set -euo pipefail

OWNER="equimanthorn"
GROUP="machinelove"
AMIGOS="${AMIGOS:-kalozano lar leon}"
SRC="/home/equimanthorn/Projects/Blood/Lar/MachineLove_spaceapps"
DST="/srv/machinelove"
KEYS_DIR="${KEYS_DIR:-/home/equimanthorn/machinelove_keys}"
SSHD_DROPIN="/etc/ssh/sshd_config.d/50-machinelove.conf"
FSTAB_LINE="$SRC $DST none bind,nofail 0 0"

[[ $EUID -eq 0 ]] || { echo "Ejecuta con sudo." >&2; exit 1; }
[[ -d $SRC ]] || { echo "No existe $SRC" >&2; exit 1; }

reload_sshd() {
  sshd -t
  if systemctl is-active --quiet sshd; then systemctl reload sshd; fi
}

if [[ ${1:-} == "--undo" ]]; then
  rm -f "$SSHD_DROPIN"
  reload_sshd
  mountpoint -q "$DST" && umount "$DST"
  sed -i "\|^$SRC $DST |d" /etc/fstab
  [[ -d $DST ]] && rmdir "$DST"
  setfacl -R -P -x "g:$GROUP" -x "u:$OWNER" "$SRC"
  setfacl -R -P -d -x "g:$GROUP" -x "u:$OWNER" "$SRC"
  echo "Revertido. Las cuentas y el grupo siguen ahí; para borrarlos:"
  for u in $AMIGOS; do echo "  userdel -r $u"; done
  echo "  groupdel $GROUP"
  exit 0
fi

# 1. Grupo y cuentas -----------------------------------------------------------
getent group "$GROUP" >/dev/null || groupadd "$GROUP"
usermod -aG "$GROUP" "$OWNER"

for u in $AMIGOS; do
  if ! id "$u" &>/dev/null; then
    useradd -m -s /bin/bash -G "$GROUP" "$u"
    usermod -p '*' "$u"                 # sin contraseña válida: solo entra con llave
  else
    usermod -aG "$GROUP" "$u"
  fi
  home="$(getent passwd "$u" | cut -d: -f6)"
  chmod 700 "$home"
  install -d -m 700 -o "$u" -g "$u" "$home/.ssh"
  if [[ -f $KEYS_DIR/$u.pub ]]; then
    install -m 600 -o "$u" -g "$u" "$KEYS_DIR/$u.pub" "$home/.ssh/authorized_keys"
    echo "[$u] llave instalada"
  else
    echo "[$u] AVISO: falta $KEYS_DIR/$u.pub; no podrá entrar hasta que la pongas y repitas el script"
  fi
  # git se niega a trabajar en un repo de otro dueño si no se marca como seguro
  sudo -u "$u" -H git config --global --replace-all safe.directory "$DST"
  # cada quien con su propio entorno virtual (el .venv del repo apunta al home del anfitrión)
  grep -q UV_PROJECT_ENVIRONMENT "$home/.bashrc" 2>/dev/null ||
    echo 'export UV_PROJECT_ENVIRONMENT="$HOME/.venvs/machinelove"' >>"$home/.bashrc"
  chown "$u:$u" "$home/.bashrc"
done

# 2. Carpeta: bind mount en /srv (el home del anfitrión sigue cerrado) ----------
install -d -m 755 "$DST"
grep -qF "$FSTAB_LINE" /etc/fstab || echo "$FSTAB_LINE" >>/etc/fstab
mountpoint -q "$DST" || mount "$DST"

# 3. Permisos: ACL rwX para el grupo, heredada por lo que se cree después -------
#    (el dueño también va en la ACL para poder tocar lo que creen los demás)
setfacl -R -P -m "g:$GROUP:rwX,u:$OWNER:rwX" "$SRC"
find "$SRC" -type d -exec setfacl -m "d:g:$GROUP:rwX,d:u:$OWNER:rwX" {} +

# 4. sshd: solo entra el grupo, solo con llave ---------------------------------
cat >"$SSHD_DROPIN" <<EOF
# Generado por setup_amigos.sh
AllowGroups $GROUP
PasswordAuthentication no
KbdInteractiveAuthentication no
X11Forwarding no
AllowAgentForwarding no
EOF
reload_sshd

echo
echo "Listo. Grupo $GROUP: $(getent group "$GROUP" | cut -d: -f4)"
echo "Proyecto en $DST. $OWNER debe cerrar sesión y volver a entrar para estrenar el grupo."
