# Hangman ☁ – AWS Cloud Development Project

## Projektbeschreibung
Dieses Projekt implementiert das klassische Spiel **Hangman** als Cloud-basierte Anwendung.  
Das Ziel ist es, grundlegende **Cloud-Architekturprinzipien** praktisch anzuwenden und dabei verschiedene **AWS-Dienste** zu integrieren.  
Das Projekt wurde im Rahmen des Faches *Cloud Development* an der OST entwickelt.

---

## Ziele
- Entwicklung einer skalierbaren, cloudbasierten Webanwendung
- Nutzung typischer AWS-Dienste (Compute, Storage, IAM, API)
- Umsetzung einer modernen Architektur (Serverless oder Container-basiert)
- Automatisierte Bereitstellung und Deployment (IaC / CI/CD)

---

## Architekturübersicht
- Frontend: statisch (S3 + CloudFront) oder im gleichen Container via Nginx ausliefern
- Backend API: Container auf ECS/Fargate, ALB davor
- Daten: DynamoDB (einfach & serverlos) – optional RDS Postgres als Bonus
- Secrets: AWS Systems Manager Parameter Store
- Logs & Metrics: CloudWatch Logs, ALB-Zugriffslogs nach S3
- Infra structure as a Service: Terraform (empfohlen) – alternativ CDK
- CI/CD: GitHub Actions → Build + Push nach ECR → Terraform Apply
---
