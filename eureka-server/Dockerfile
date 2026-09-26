# Built from the repository root so the parent pom and the shared 'common' module are in scope:
#   docker build -f eureka-server/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
# Poms first, so a source-only change does not re-resolve every dependency.
COPY pom.xml .
COPY common/pom.xml common/
COPY eureka-server/pom.xml eureka-server/
RUN mvn -q -B -pl common,eureka-server -am dependency:go-offline
COPY common/src common/src
COPY eureka-server/src eureka-server/src
RUN mvn -q -B -pl common,eureka-server -am -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/eureka-server/target/eureka-server-1.0.0.jar app.jar
# Render sets PORT; the cloud profile binds to it.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
ENTRYPOINT ["sh","-c","exec java $JAVA_OPTS -jar app.jar"]
