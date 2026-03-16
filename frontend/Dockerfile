FROM crpsndxcdpvil01.azurecr.io/node/node-dxc:latest AS build-portal
WORKDIR /app
COPY . /app

RUN rm -rf node_modules/ \
	&& npm config set strict-ssl false -g \
	&& npm ci 2>/dev/null || npm install \
	&& npm run build:webpack

# --- SONAR START ---
# FROM crpsndxcdpvil01.azurecr.io/sonarqube/sonarscanner-dxc:latest AS sonar
# WORKDIR /app
# COPY --from=build-portal /app /app
#
# RUN sonar-scanner \
#     -Dsonar.projectKey=<project-key> \
#     -Dsonar.projectName=@mase/siv \
#     -Dsonar.sources=. \
#     -Dsonar.host.url=http://sonarqube-sonarqube:9000 \
#     -Dsonar.login=<token>
# --- SONAR END ---

FROM crpsndxcdpvil01.azurecr.io/nginx/nginx-dxc:latest
COPY --from=build-portal --chown=nginx:nginx /app/dist /usr/share/nginx/html/
