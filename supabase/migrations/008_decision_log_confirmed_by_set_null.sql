alter table decision_log
  drop constraint decision_log_confirmed_by_fkey,
  add constraint decision_log_confirmed_by_fkey
    foreign key (confirmed_by) references profiles(id) on delete set null;
