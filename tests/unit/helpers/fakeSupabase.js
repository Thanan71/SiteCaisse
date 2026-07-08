export function createFakeSupabase(initialTables = {}) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([tableName, rows]) => [
      tableName,
      rows.map((row) => ({ ...row })),
    ]),
  )
  const calls = []

  function getTable(tableName) {
    if (!tables[tableName]) tables[tableName] = []
    return tables[tableName]
  }

  return {
    calls,
    tables,
    client: {
      from(tableName) {
        calls.push({ method: 'from', tableName })
        return new FakeQueryBuilder(tableName, getTable(tableName), calls)
      },
    },
  }
}

class FakeQueryBuilder {
  constructor(tableName, table, calls) {
    this.tableName = tableName
    this.table = table
    this.calls = calls
    this.filters = []
    this.orders = []
    this.rangeBounds = null
    this.limitCount = null
    this.operation = 'select'
    this.payload = null
    this.selectOptions = {}
    this.singleMode = null
  }

  select(columns = '*', options = {}) {
    this.calls.push({ method: 'select', tableName: this.tableName, columns, options })
    this.operation = this.operation || 'select'
    this.columns = columns
    this.selectOptions = options || {}
    return this
  }

  insert(payload) {
    this.calls.push({ method: 'insert', tableName: this.tableName, payload })
    this.operation = 'insert'
    this.payload = payload
    return this
  }

  update(payload) {
    this.calls.push({ method: 'update', tableName: this.tableName, payload })
    this.operation = 'update'
    this.payload = payload
    return this
  }

  delete() {
    this.calls.push({ method: 'delete', tableName: this.tableName })
    this.operation = 'delete'
    return this
  }

  eq(column, value) {
    this.calls.push({ method: 'eq', tableName: this.tableName, column, value })
    this.filters.push((row) => String(row[column]) === String(value))
    return this
  }

  in(column, values) {
    this.calls.push({ method: 'in', tableName: this.tableName, column, values })
    const normalizedValues = values.map((value) => String(value))
    this.filters.push((row) => normalizedValues.includes(String(row[column])))
    return this
  }

  gte(column, value) {
    this.calls.push({ method: 'gte', tableName: this.tableName, column, value })
    this.filters.push((row) => row[column] >= value)
    return this
  }

  lte(column, value) {
    this.calls.push({ method: 'lte', tableName: this.tableName, column, value })
    this.filters.push((row) => row[column] <= value)
    return this
  }

  order(column, options = {}) {
    this.calls.push({ method: 'order', tableName: this.tableName, column, options })
    this.orders.push({ column, ascending: options.ascending !== false })
    return this
  }

  range(from, to) {
    this.calls.push({ method: 'range', tableName: this.tableName, from, to })
    this.rangeBounds = { from, to }
    return this
  }

  limit(count) {
    this.calls.push({ method: 'limit', tableName: this.tableName, count })
    this.limitCount = count
    return this
  }

  maybeSingle() {
    this.singleMode = 'maybe'
    return Promise.resolve(this.execute())
  }

  single() {
    this.singleMode = 'single'
    return Promise.resolve(this.execute())
  }

  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable thenables.
  then(resolve, reject) {
    return Promise.resolve(this.execute()).then(resolve, reject)
  }

  execute() {
    if (this.operation === 'insert') return this.executeInsert()
    if (this.operation === 'update') return this.executeUpdate()
    if (this.operation === 'delete') return this.executeDelete()
    return this.executeSelect()
  }

  executeInsert() {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload]
    const insertedRows = rows.map((row) => {
      const nextId =
        row.id ?? this.table.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1
      return { id: nextId, ...row }
    })
    this.table.push(...insertedRows)
    return this.formatResult(insertedRows)
  }

  executeUpdate() {
    const matchingRows = this.getFilteredRows()
    for (const row of matchingRows) {
      Object.assign(row, this.payload)
    }
    return this.formatResult(matchingRows)
  }

  executeDelete() {
    const matchingRows = this.getFilteredRows()
    for (const row of matchingRows) {
      const index = this.table.indexOf(row)
      if (index >= 0) this.table.splice(index, 1)
    }
    return this.formatResult(matchingRows)
  }

  executeSelect() {
    let rows = this.getFilteredRows()
    rows = this.applyOrdering(rows)

    const count = rows.length
    if (this.selectOptions.head) {
      return { count, data: null, error: null }
    }

    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount)
    if (this.rangeBounds) rows = rows.slice(this.rangeBounds.from, this.rangeBounds.to + 1)

    return this.formatResult(rows, count)
  }

  getFilteredRows() {
    return this.table.filter((row) => this.filters.every((filter) => filter(row)))
  }

  applyOrdering(rows) {
    return [...rows].sort((left, right) => {
      for (const { column, ascending } of this.orders) {
        if (left[column] === right[column]) continue
        const result = left[column] > right[column] ? 1 : -1
        return ascending ? result : -result
      }
      return 0
    })
  }

  formatResult(rows, count = rows.length) {
    const dataRows = rows.map((row) => ({ ...row }))

    if (this.singleMode === 'maybe') {
      return { data: dataRows[0] || null, error: null }
    }

    if (this.singleMode === 'single') {
      return dataRows[0]
        ? { data: dataRows[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'No rows' } }
    }

    return { data: dataRows, count, error: null }
  }
}
