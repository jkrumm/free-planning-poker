import os
import MySQLdb
import pandas as pd

from util.log_util import logger


class DB:
    conn = None

    def connect(self):
        self.conn = MySQLdb.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USERNAME"),
            passwd=os.getenv("DB_PASSWORD"),
            db="free-planning-poker",
            autocommit=True,
        )

    def query(self, sql):
        try:
            cursor = self.conn.cursor()
            cursor.execute(sql)
        except (AttributeError, MySQLdb.OperationalError):
            self.connect()
            cursor = self.conn.cursor()
            cursor.execute(sql)
        return cursor


def upsert_table(cursor, table_name, dtypes_def):
    if table_name == "fpp_users":
        upsert_users(cursor)
        return

    parquet_file = f"./data/{table_name}.parquet"

    # Load existing Parquet file (if exists)
    if os.path.isfile(parquet_file):
        df_parquet = pd.read_parquet(parquet_file)
        if not df_parquet.empty:
            last_id = df_parquet.index.max()  # Assuming 'id' is the column with IDs
        else:
            last_id = 0
    else:
        df_parquet = pd.DataFrame()
        last_id = 0

    cursor.execute(f"SELECT * FROM {table_name} WHERE id > {last_id}")

    missing_records = cursor.fetchall()
    missing_records_column_names = [i[0] for i in cursor.description]
    df_mysql = pd.DataFrame(missing_records, columns=missing_records_column_names)

    amount_of_new_records = len(df_mysql)

    if amount_of_new_records == 0:
        logger.debug(f"No new records for table", {"table_name": table_name})
        return

    df_mysql.set_index('id', inplace=True)

    df_mysql = df_mysql.astype(dtypes_def)

    if table_name == "fpp_votes":
        df_mysql['was_auto_flip'] = df_mysql['was_auto_flip'].map({0: False, 1: True})

    # Debug info
    # logger.debug(df_mysql.head())
    # logger.debug(df_mysql.dtypes)
    # logger.debug({
    #     "df_parquet": len(df_parquet),
    #     "df_mysql": len(df_mysql)
    # })

    # Merge new data from MySQL with existing data in Parquet
    df = pd.concat([df_mysql, df_parquet])
    df.to_parquet(parquet_file)

    logger.info(f"Upserted records for in read model", {
        "table_name": table_name,
        "amount_of_new_records": amount_of_new_records
    })


def upsert_users(cursor):
    parquet_file = f"./data/fpp_users.parquet"

    # Load existing Parquet file (if exists)
    if os.path.isfile(parquet_file):
        df_parquet = pd.read_parquet(parquet_file)
        if not df_parquet.empty:
            last_created_at = df_parquet['created_at'].max()
        else:
            last_created_at = None
    else:
        df_parquet = pd.DataFrame()
        last_created_at = None

    if last_created_at is not None:
        cursor.execute(f"SELECT * FROM fpp_users WHERE created_at > '{last_created_at}' ORDER BY created_at DESC")
    else:
        cursor.execute("SELECT * FROM fpp_users ORDER BY created_at DESC")

    missing_records = cursor.fetchall()
    missing_records_column_names = [i[0] for i in cursor.description]
    df_mysql = pd.DataFrame(missing_records, columns=missing_records_column_names)

    amount_of_new_records = len(df_mysql)

    if amount_of_new_records == 0:
        logger.debug(f"No new records for table", {"table_name": "fpp_users"})
        return

    # Merge new data from MySQL with existing data in Parquet
    df = pd.concat([df_mysql, df_parquet])
    df.to_parquet(parquet_file)

    logger.info(f"Upserted records for in read model", {
        "table_name": "fpp_users",
        "amount_of_new_records": amount_of_new_records
    })


def update_read_model():
    logger.debug("update_read_model called!")

    # Create cursor and use it to execute SQL command
    db = DB()
    cursor = db.query("select @@version")
    version = cursor.fetchone()

    if version:
        logger.debug(f"Running version: ${version}")
    else:
        logger.debug('Not connected to db')

    upsert_table(cursor, "fpp_estimations", {'user_id': 'str', 'room_id': 'int16', 'spectator': 'int16'})
    upsert_table(cursor, "fpp_events", {'user_id': 'str', 'event': 'category'})
    upsert_table(cursor, "fpp_page_views", {'user_id': 'str', 'route': 'category', 'room_id': 'Int16'})
    upsert_table(cursor, "fpp_rooms", {'number': 'int16', 'name': 'str'})
    upsert_table(cursor, "fpp_votes", {'room_id': 'int16', 'min_estimation': 'int16', 'max_estimation': 'int16',
                                       'amount_of_estimations': 'int16', 'amount_of_spectators': 'int16',
                                       'duration': 'int16'})

    upsert_users(cursor)


def update_votes_read_model():
    logger.debug("update_votes read_model called!")

    # Create cursor and use it to execute SQL command
    db = DB()
    cursor = db.query("select @@version")
    version = cursor.fetchone()

    if version:
        logger.debug(f"Running version: ${version}")
    else:
        logger.debug('Not connected to db')

    upsert_table(cursor, "fpp_votes", {'room_id': 'int16', 'min_estimation': 'int16', 'max_estimation': 'int16',
                                       'amount_of_estimations': 'int16', 'amount_of_spectators': 'int16',
                                       'duration': 'int16'})
