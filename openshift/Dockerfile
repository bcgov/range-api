FROM registry.access.redhat.com/rhscl/postgresql-96-rhel7:latest

USER 0

ENV PATH=$HOME/.local/bin/:$PATH \
    LC_ALL=en_US.UTF-8 \
    LANG=en_US.UTF-8
   
ENV SUMMARY="PostgreSQL 9.6 with PostGIS extension." \
    DESCRIPTION="PostgreSQL 9.6 with PostGIS extension."

LABEL summary="$SUMMARY" \
  description="$DESCRIPTION" \
  io.k8s.description="$DESCRIPTION" \
  io.k8s.display-name="PostgreSQL-9_6-PostGIS" \
  io.openshift.expose-services="5432:http" \
  io.openshift.tags="postgres,postgis" \
  release="1"

RUN yum repolist > /dev/null && \
    yum install -y yum-utils && \
    yum-config-manager --disable \* &> /dev/null && \
    yum-config-manager --enable rhel-server-rhscl-7-rpms && \
    yum-config-manager --enable rhel-7-server-rpms && \
    yum-config-manager --enable rhel-7-server-optional-rpms && \
    yum-config-manager --enable rhel-7-server-fastrack-rpms && \
    yum install curl && \
    curl -O https://download.postgresql.org/pub/repos/yum/9.6/redhat/rhel-7-x86_64/pgdg-redhat96-9.6-3.noarch.rpm && \
    yum -y localinstall pgdg-redhat96-9.6-3.noarch.rpm && \
    rm -f pgdg-redhat96-9.6-3.noarch.rpm

RUN yum list post\*

# The RHEL Extra Packages for Enterprise Linux (EPEL) package `epel-release` 
# is required gdal-libs dependencies. 
RUN yum install epel-release postgis2_96.x86_64 postgis2_96-client.x86_64 postgis2_96-utils.x86_64
