import os
import MySQLdb
import pandas as pd

from util.log_util import logger

connection = MySQLdb.connect(
    host=os.getenv("DB_HOST"),
    user=os.getenv("DB_USERNAME"),
    passwd=os.getenv("DB_PASSWORD"),
    db=os.getenv("DB_NAME"),
    autocommit=True,
    ssl_mode="VERIFY_IDENTITY",
    ssl={
        "ca": "/etc/ssl/cert.pem"
    }
)


def upsert_table(cursor, table_name, dtypes_def):
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

    # TODO: improve user update logic
    # Read new data from MySQL
    if table_name != "fpp_users":
        cursor.execute(f"SELECT * FROM {table_name} WHERE id > {last_id}")
    else:
        cursor.execute("SELECT * FROM fpp_users ORDER BY created_at DESC")

    missing_records = cursor.fetchall()
    missing_records_column_names = [i[0] for i in cursor.description]
    df_mysql = pd.DataFrame(missing_records, columns=missing_records_column_names)

    amount_of_new_records = len(df_mysql)

    if amount_of_new_records == 0:
        logger.debug(f"No new records for table", {"table_name": table_name})
        return

    if table_name != "fpp_users":
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
    if table_name != "fpp_users":
        df = pd.concat([df_mysql, df_parquet])
        df.to_parquet(parquet_file)
    else:
        df_mysql.to_parquet(parquet_file)

    logger.info(f"Upserted records for in read model", {
        "table_name": table_name,
        "amount_of_new_records": amount_of_new_records
    })


def update_read_model():
    logger.debug("update_read_model called!")

    # Create cursor and use it to execute SQL command
    cursor = connection.cursor()
    cursor.execute("select @@version")
    version = cursor.fetchone()

    if version:
        logger.debug(f"Running version: ${version}")
    else:
        logger.debug('Not connected to db')

    upsert_table(cursor, "fpp_estimations",
                 {'user_id': 'str', 'room_id': 'int16', 'estimation': 'int16', 'spectator': 'int16'})
    upsert_table(cursor, "fpp_events", {'user_id': 'str', 'event': 'category'})
    upsert_table(cursor, "fpp_page_views", {'user_id': 'str', 'route': 'category', 'room_id': 'Int16'})
    upsert_table(cursor, "fpp_rooms", {'number': 'int16', 'name': 'str'})
    upsert_table(cursor, "fpp_votes", {'room_id': 'int16', 'min_estimation': 'int16', 'max_estimation': 'int16',
                                       'amount_of_estimations': 'int16', 'amount_of_spectators': 'int16',
                                       'duration': 'int16'})
    upsert_table(cursor, "fpp_users", {})
