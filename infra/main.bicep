// Assistant API: the Container App, using the existing Container Apps environment and Container Registry.
// Scope: resource group. The registry and environment already exist and are referenced, not created.
// No secrets in this file. App settings and secrets are added later, per the founder's decisions.

@description('Name of the existing Container Registry (lowercase letters and numbers only).')
param registryName string

@description('Name of the existing Container Apps environment in this resource group.')
param environmentName string

@description('Region of the existing Container Apps environment. Must match it exactly.')
param location string = 'canadacentral'

@description('Container App name. Must match the existing app so the deployment updates it.')
param containerAppName string = 'container-app-e4af-assistant-ai'

@description('Full container image. Use the public placeholder until assistant-api is pushed. Later, the pipeline passes glendevaiassistantacr.azurecr.io/assistant-api:<unique tag>.')
param image string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Port the container listens on. 80 for the placeholder image. Set to 8080 for assistant-api.')
param targetPort int = 80

@minValue(0)
@description('Minimum replicas. 1 avoids cold starts for the demo.')
param minReplicas int = 1

@minValue(1)
@maxValue(1)
@description('Maximum replicas. Keep at 1 until conversation state and the audit log move out of process memory.')
param maxReplicas int = 1

// [ASSUMED] The registry and the environment are in the same resource group as this deployment.
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: registryName
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentName
}

// The app's location must match the environment's location. Check the environment's region in the portal.
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: '${registryName}.azurecr.io'
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: containerAppName
          image: image
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

// Lets the Container App's managed identity pull images. The admin user stays disabled.
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, containerApp.id, 'AcrPull')
  scope: registry
  properties: {
    // AcrPull built-in role
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
