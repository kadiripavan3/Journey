# The Journey API as a small image. Build it from the repository root:
#   docker build -t journey-api apps/api
# It needs a database (JOURNEY_DB_URL, JOURNEY_DB_USER, JOURNEY_DB_PASSWORD) and, once they are connected,
# the sign-in and storage services. See docs/02-tech-stack.md.

FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
# The dependencies change far less often than the code, so they get a layer of their own.
RUN ./mvnw -B -ntp dependency:go-offline
COPY src src
# The tests need a database and run in CI, not here.
RUN ./mvnw -B -ntp -DskipTests package

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 --no-create-home journey
WORKDIR /app
COPY --from=build /src/target/journey-api-*.jar app.jar
USER journey
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "app.jar"]
