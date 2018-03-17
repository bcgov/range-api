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
    yum-config-manager --enable rhel-7-server-extras-rpms && \
    yum-config-manager --enable rhel-7-server-fastrack-rpms && \
    yum install curl && \
    curl -O https://download.postgresql.org/pub/repos/yum/9.6/redhat/rhel-7-x86_64/pgdg-redhat96-9.6-3.noarch.rpm && \
    curl -O https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm && \
    yum -y localinstall pgdg-redhat96-9.6-3.noarch.rpm epel-release-latest-7.noarch.rpm && \
    yum -y update && \
    rm -f pgdg-redhat96-9.6-3.noarch.rpm && \
    rm -f epel-release-latest-7.noarch.rpm

# The RHEL Extra Packages for Enterprise Linux (EPEL) package `epel-release` 
# is required gdal-libs dependencies. 

RUN yum list epel\* && \
    yum list post\* && \
    yum -y install epel-release postgis2_96.x86_64 postgis2_96-client.x86_64 postgis2_96-utils.x86_64 && \
    yum clean all

# The install does not put them in the same place as the other PostgreSQL exteions
# so lets move them.

RUN diff --brief -r \
    /opt/rh/rh-postgresql96/root/usr/share/pgsql/extension \
    /usr/pgsql-9.6/share/extension | \
    grep '/usr/pgsql-9.6/share/extension' | \
    tr ':' '/' |  \
    awk '{ print $3 $4 }' | \
    xargs cp -vt /opt/rh/rh-postgresql96/root/usr/share/pgsql/extension

# PostgreSQL user

USER 26
