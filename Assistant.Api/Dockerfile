# Build context is the Assistant.Api folder (the one that holds Assistant.Api.sln).
# Build with: docker build --platform linux/amd64 -t glendevaiassistantacr.azurecr.io/assistant-api:v1 ./Assistant.Api

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish Assistant.Api/Assistant.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
# [ASSUMED] Container Apps ingress forwards to port 8080. TLS is terminated at ingress.
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER app
ENTRYPOINT ["dotnet", "Assistant.Api.dll"]
