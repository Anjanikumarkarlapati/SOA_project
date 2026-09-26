# Built from the repository root so the parent pom and the shared 'common' module are in scope:
#   docker build -f irrigation-service/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
# Poms first, so a source-only change does not re-resolve every dependency.
COPY pom.xml .
COPY common/pom.xml common/
COPY irrigation-service/pom.xml irrigation-service/
RUN mvn -q -B -pl common,irrigation-service -am dependency:go-offline
COPY common/src common/src
COPY irrigation-service/src irrigation-service/src
RUN mvn -q -B -pl common,irrigation-service -am -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/irrigation-service/target/irrigation-service-1.0.0.jar app.jar
# Render sets PORT; the cloud profile binds to it.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
ENTRYPOINT ["sh","-c","exec java $JAVA_OPTS -jar app.jar"]
