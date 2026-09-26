# Built from the repository root so the parent pom and the shared 'common' module are in scope:
#   docker build -f sensor-service/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
# Poms first, so a source-only change does not re-resolve every dependency.
COPY pom.xml .
COPY common/pom.xml common/
COPY sensor-service/pom.xml sensor-service/
RUN mvn -q -B -pl common,sensor-service -am dependency:go-offline
COPY common/src common/src
COPY sensor-service/src sensor-service/src
RUN mvn -q -B -pl common,sensor-service -am -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/sensor-service/target/sensor-service-1.0.0.jar app.jar
# Render sets PORT; the cloud profile binds to it.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
ENTRYPOINT ["sh","-c","exec java $JAVA_OPTS -jar app.jar"]
