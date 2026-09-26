# Built from the repository root so the parent pom and the shared 'common' module are in scope:
#   docker build -f crop-service/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
# Poms first, so a source-only change does not re-resolve every dependency.
COPY pom.xml .
COPY common/pom.xml common/
COPY crop-service/pom.xml crop-service/
RUN mvn -q -B -pl common,crop-service -am dependency:go-offline
COPY common/src common/src
COPY crop-service/src crop-service/src
RUN mvn -q -B -pl common,crop-service -am -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/crop-service/target/crop-service-1.0.0.jar app.jar
# Render sets PORT; the cloud profile binds to it.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
ENTRYPOINT ["sh","-c","exec java $JAVA_OPTS -jar app.jar"]
