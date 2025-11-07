# Anleitung: Docker Container bauen und Stack mit Docker Compose starten

Diese Anleitung beschreibt Schritt für Schritt, wie Sie ein bestehendes GitHub-Repository mit Dockerfile und Docker Compose nutzen, um einen Container zu bauen und den Stack zu starten.

---

## 1. Voraussetzungen

Bevor Sie beginnen, stellen Sie sicher, dass folgende Tools installiert sind:

- **Docker**: [Installationsanleitung](https://docs.docker.com/get-docker/)  
- **Docker Compose** (meistens bereits mit Docker Desktop enthalten)  
- **Git**: [Installationsanleitung](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)  

---

## 2. Repository klonen

Klonen Sie das Repository auf Ihren lokalen Rechner und wechseln Sie in das Projektverzeichnis:

  `git clone https://github.com/livioambr/CLDE-Gruppe-6/\
  cd CLDE-Gruppe-6`

## 3. Docker image build

  `docker build -t hangman:v0.2 -f docker/dockerfile .`

## 4. Stack starten

  `cd docker\
  docker compose up -d`


