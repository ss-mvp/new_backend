const moment = require('moment')


exports.up = function(knex) {
  return knex.schema
  
  .createTable('votersIP', table => {
    table.increments()
    table.string('ip')
    // table.timestamp('date_voted').defaultTo(moment(new Date(), 'MMM-DD-YYYY'))
  })

  .createTable('topThree', table => {
    table.increments()
    table.integer('story_id').unsigned()
      .references('id').inTable('submissions')
      .onDelete('CASCADE');
      table.integer('user_id').unsigned()
      .references('id').inTable('users')
      .onDelete('CASCADE');
      table.integer('prompt_id').unsigned()
      .references('id').inTable('prompts')
      .onDelete('CASCADE');
      table.integer('prompt_time_id').unsigned()
      .references('id').inTable('prompt_time')
      .onDelete('CASCADE');
      // table.integer('score').defaultTo(0)
  })

  .createTable('ranking', table => {
    table.increments()
    table.integer('topthree_id').unsigned()
      .references('id').inTable('topThree')
      .onDelete('CASCADE')
    table.integer('rank').notNullable()
  })
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('ranking')
    .dropTableIfExists('topThree')
    .dropTableIfExists('votersIP')
};
